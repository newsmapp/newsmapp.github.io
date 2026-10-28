import { correctionRequests, submissions } from '../db/schema';
import { outletHostKey, type RuntimeCatalog } from '../lib/catalog/public';
import { tierFor, type Pricing } from '../lib/monetization/pricing';
import {
  checkoutPayloadSchema,
  correctionPayloadSchema,
  submitPayloadSchema,
} from '../schemas/monetization.schema';
import { newId } from './crypto';
import { iso, type Database } from './db';
import { fieldErrors, json, problem } from './http';
import { createCheckout, type LemonSqueezyConfig } from './lemonsqueezy';
import { heldBy, MAX_HOLDS_PER_VISITOR, releaseReservation, reserveSlot } from './sponsorships';
import { MESSAGES } from './messages';
import { localizePath, type Lang } from '../lib/i18n/lang';

export interface FormDeps {
  db: Database;
  now: Date;
  siteUrl: string;
  /** Turnstile check for the token in the payload. */
  human: (token: string) => Promise<boolean>;
  /** Language of the answer (requestLang). */
  lang?: Lang;
}

/** Free outlet suggestion: stored for the editor, never published automatically. */
export async function submitSuggestion(body: unknown, deps: FormDeps): Promise<Response> {
  const lang = deps.lang ?? 'en';
  const m = MESSAGES[lang];
  const parsed = submitPayloadSchema.safeParse(body);
  if (!parsed.success) return problem(422, m.checkFields, fieldErrors(parsed.error.issues, lang));
  const { turnstile_token: token, ...data } = parsed.data;
  if (!(await deps.human(token))) return problem(403, m.notHuman);
  await deps.db.insert(submissions).values({
    id: newId('sub'),
    ...data,
    note: data.note ?? null,
    plan: 'free',
    status: 'pending',
    created_at: iso(deps.now),
    updated_at: iso(deps.now),
  });
  return json({ message: m.suggestionThanks }, 201);
}

export async function submitCorrection(
  body: unknown,
  deps: FormDeps & { catalog: RuntimeCatalog },
): Promise<Response> {
  const lang = deps.lang ?? 'en';
  const m = MESSAGES[lang];
  const parsed = correctionPayloadSchema.safeParse(body);
  if (!parsed.success) return problem(422, m.checkFields, fieldErrors(parsed.error.issues, lang));
  const { turnstile_token: token, ...data } = parsed.data;
  if (!Object.hasOwn(deps.catalog, data.outlet_id)) {
    return problem(422, m.checkFields, { outlet_id: m.fields.outlet_id ?? m.checkField });
  }
  if (!(await deps.human(token))) return problem(403, m.notHuman);
  await deps.db.insert(correctionRequests).values({
    id: newId('cor'),
    ...data,
    contact_email: data.contact_email ?? null,
    status: 'open',
    created_at: iso(deps.now),
  });
  return json({ message: m.correctionThanks }, 201);
}

export interface CheckoutDeps extends FormDeps {
  /** outletHostIndex() of the runtime catalog. */
  outletsByHost: ReadonlyMap<string, string>;
  /** Published countries (ISO 3166-1 alpha-2): a slot elsewhere would never be shown. */
  countries: ReadonlySet<string>;
  /** Daily keyed hash of the buyer's IP (one unpaid hold per visitor); null when unknown. */
  holder: string | null;
  pricing: Pricing;
  /** Null runs simulation mode: no payment provider is called. */
  lemonSqueezy: LemonSqueezyConfig | null;
}

/** Reserves a slot for 30 minutes and sends the buyer to payment (SPEC §3.6.1 steps 1–2). */
export async function startCheckout(body: unknown, deps: CheckoutDeps): Promise<Response> {
  const lang = deps.lang ?? 'en';
  const m = MESSAGES[lang];
  const parsed = checkoutPayloadSchema.safeParse(body);
  if (!parsed.success) return problem(422, m.checkFields, fieldErrors(parsed.error.issues, lang));
  const { turnstile_token: token, plan, ...data } = parsed.data;
  if (!deps.countries.has(data.country_iso))
    return problem(422, m.checkFields, { country_iso: m.fields.country_iso ?? m.checkField });
  if (!(await deps.human(token))) return problem(403, m.notHuman);

  const tier = tierFor(deps.pricing, data.country_iso);
  const variantId = tier.variant_ids[plan];
  if (deps.lemonSqueezy && !variantId) return problem(503, m.notOnSale);

  if (deps.holder && (await heldBy(deps.db, deps.holder, deps.now)) >= MAX_HOLDS_PER_VISITOR) {
    return problem(429, m.holdsOpen);
  }
  const reservation = await reserveSlot(
    deps.db,
    {
      ...data,
      plan,
      outlet_id: deps.outletsByHost.get(outletHostKey(data.country_iso, data.url)) ?? null,
      holder: deps.holder,
    },
    deps.pricing.slots_per_category,
    deps.now,
  );
  if (!reservation) {
    return problem(409, m.slotsFull);
  }

  const thanks = new URL(localizePath('/advertise/thanks/', lang), deps.siteUrl);
  if (!deps.lemonSqueezy) {
    thanks.searchParams.set('simulated', '1');
    return json(
      { redirect: thanks.toString(), simulated: true, submission_id: reservation.submissionId },
      201,
    );
  }
  try {
    const url = await createCheckout(deps.lemonSqueezy, {
      variantId,
      email: data.contact_email,
      submissionId: reservation.submissionId,
      redirectUrl: thanks.toString(),
      expiresAt: reservation.reservedUntil,
    });
    return json({ redirect: url }, 201);
  } catch (error) {
    // No checkout, no hold: otherwise every retry would take another slot for 30 minutes.
    await releaseReservation(deps.db, deps.now, reservation.sponsorshipId);
    console.error(error);
    return problem(502, m.paymentFailed);
  }
}
