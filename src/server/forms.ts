import { correctionRequests, submissions } from '../db/schema';
import type { RuntimeCatalog } from '../lib/catalog/public';
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
import { reserveSlot } from './sponsorships';

export interface FormDeps {
  db: Database;
  now: Date;
  siteUrl: string;
  /** Turnstile check for the token in the payload. */
  human: (token: string) => Promise<boolean>;
}

const NOT_HUMAN = 'The anti-spam check failed. Reload the page and try again.';

/** Free outlet suggestion: stored for the editor, never published automatically. */
export async function submitSuggestion(body: unknown, deps: FormDeps): Promise<Response> {
  const parsed = submitPayloadSchema.safeParse(body);
  if (!parsed.success)
    return problem(422, 'Check the highlighted fields.', fieldErrors(parsed.error.issues));
  const { turnstile_token: token, ...data } = parsed.data;
  if (!(await deps.human(token))) return problem(403, NOT_HUMAN);
  await deps.db.insert(submissions).values({
    id: newId('sub'),
    ...data,
    note: data.note ?? null,
    plan: 'free',
    status: 'pending',
    created_at: iso(deps.now),
    updated_at: iso(deps.now),
  });
  return json(
    { message: 'Thank you. An editor will review the outlet, usually within a week.' },
    201,
  );
}

export async function submitCorrection(
  body: unknown,
  deps: FormDeps & { catalog: RuntimeCatalog },
): Promise<Response> {
  const parsed = correctionPayloadSchema.safeParse(body);
  if (!parsed.success)
    return problem(422, 'Check the highlighted fields.', fieldErrors(parsed.error.issues));
  const { turnstile_token: token, ...data } = parsed.data;
  if (!Object.hasOwn(deps.catalog, data.outlet_id)) {
    return problem(422, 'Check the highlighted fields.', {
      outlet_id: 'Choose an outlet from the list.',
    });
  }
  if (!(await deps.human(token))) return problem(403, NOT_HUMAN);
  await deps.db.insert(correctionRequests).values({
    id: newId('cor'),
    ...data,
    contact_email: data.contact_email ?? null,
    status: 'open',
    created_at: iso(deps.now),
  });
  return json({ message: 'Thank you. An editor will review the correction.' }, 201);
}

export interface CheckoutDeps extends FormDeps {
  catalog: RuntimeCatalog;
  pricing: Pricing;
  /** Null runs simulation mode: no payment provider is called. */
  lemonSqueezy: LemonSqueezyConfig | null;
}

/** Reserves a slot for 30 minutes and sends the buyer to payment (SPEC §3.6.1 steps 1–2). */
export async function startCheckout(body: unknown, deps: CheckoutDeps): Promise<Response> {
  const parsed = checkoutPayloadSchema.safeParse(body);
  if (!parsed.success)
    return problem(422, 'Check the highlighted fields.', fieldErrors(parsed.error.issues));
  const { turnstile_token: token, plan, ...data } = parsed.data;
  if (!(await deps.human(token))) return problem(403, NOT_HUMAN);

  const tier = tierFor(deps.pricing, data.country_iso);
  const variantId = tier.variant_ids[plan];
  if (deps.lemonSqueezy && !variantId)
    return problem(503, 'Sponsorships are not on sale yet. Write to us instead.');

  const host = new URL(data.url).hostname.replace(/^www\./, '');
  const known = Object.entries(deps.catalog).find(
    ([, outlet]) =>
      outlet.country === data.country_iso &&
      new URL(outlet.url).hostname.replace(/^www\./, '') === host,
  );
  const reservation = await reserveSlot(
    deps.db,
    { ...data, plan, outlet_id: known?.[0] ?? null },
    deps.pricing.slots_per_category,
    deps.now,
  );
  if (!reservation) {
    return problem(
      409,
      'All places in this category are taken. Choose another category or write to us.',
    );
  }

  const thanks = new URL('/advertise/thanks/', deps.siteUrl);
  if (!deps.lemonSqueezy) {
    thanks.searchParams.set('simulated', '1');
    return json(
      { redirect: thanks.toString(), simulated: true, submission_id: reservation.submissionId },
      201,
    );
  }
  const url = await createCheckout(deps.lemonSqueezy, {
    variantId,
    email: data.contact_email,
    submissionId: reservation.submissionId,
    redirectUrl: thanks.toString(),
    expiresAt: reservation.reservedUntil,
  });
  return json({ redirect: url }, 201);
}
