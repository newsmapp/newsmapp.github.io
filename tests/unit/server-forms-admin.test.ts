import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { correctionRequests, sponsorships, submissions } from '@/db/schema';
import type { Database } from '@/server/db';
import { overview, runAction, toCsv } from '@/server/admin';
import {
  startCheckout,
  submitCorrection,
  submitSuggestion,
  type CheckoutDeps,
} from '@/server/forms';
import { maintain, retentionCutoff, runDailyMaintenance } from '@/server/maintenance';
import { createTestD1 } from '../helpers/d1';
import { NOW, fakeFetch, jsonResponse, testDb } from '../helpers/server';
import type { RuntimeCatalog } from '@/lib/catalog/public';
import type { Pricing } from '@/lib/monetization/pricing';

const catalog = {
  'pt-a': {
    name: 'A',
    url: 'https://www.a.example.com/',
    country: 'PT',
    slug: 'a',
    categories: ['sports'],
    country_slug: 'portugal',
    country_name: 'Portugal',
    badge: { position: 1, category: 'sports' },
  },
} satisfies RuntimeCatalog;

const pricing: Pricing = {
  currency: 'USD',
  default_tier: 1,
  tiers: [
    {
      tier: 1,
      countries: ['PT'],
      monthly: 29,
      yearly: 249,
      variant_ids: { monthly: '11', yearly: '' },
    },
  ],
  slots_per_category: 1,
};

const order = {
  country_iso: 'PT',
  category: 'sports',
  plan: 'monthly',
  outlet_name: 'A',
  url: 'https://a.example.com/',
  contact_email: 'billing@example.com',
  turnstile_token: 'token',
};

const { plan: _plan, ...suggestion } = order;

let db: Database;
let deps: CheckoutDeps;
beforeEach(() => {
  db = testDb();
  deps = {
    db,
    now: NOW,
    siteUrl: 'https://newsmap.example',
    human: async () => true,
    catalog,
    pricing,
    lemonSqueezy: null,
  };
});

describe('suggestions and corrections', () => {
  it('stores a free suggestion for review', async () => {
    const response = await submitSuggestion({ ...suggestion, note: 'Regional daily' }, deps);
    expect(response.status).toBe(201);
    const [row] = await db.select().from(submissions);
    expect(row).toMatchObject({ plan: 'free', status: 'pending', note: 'Regional daily' });
  });

  it('rejects invalid input with field messages and failed anti-spam checks', async () => {
    const invalid = await submitSuggestion({ url: 'http://x' }, deps);
    expect(invalid.status).toBe(422);
    expect(((await invalid.json()) as { fields: Record<string, string> }).fields.url).toMatch(
      /https/,
    );
    const bot = await submitSuggestion(suggestion, { ...deps, human: async () => false });
    expect(bot.status).toBe(403);
    expect(await db.select().from(submissions)).toHaveLength(0);
  });

  it('accepts corrections only for listed outlets', async () => {
    const payload = {
      outlet_id: 'pt-a',
      field: 'url',
      message: 'Moved to a new domain.',
      turnstile_token: 't',
    };
    expect((await submitCorrection(payload, deps)).status).toBe(201);
    expect((await submitCorrection({ ...payload, outlet_id: 'pt-candidate' }, deps)).status).toBe(
      422,
    );
    expect((await submitCorrection({ ...payload, message: '' }, deps)).status).toBe(422);
    expect((await submitCorrection(payload, { ...deps, human: async () => false })).status).toBe(
      403,
    );
    const [row] = await db.select().from(correctionRequests);
    expect(row).toMatchObject({ status: 'open', contact_email: null });
  });
});

describe('startCheckout', () => {
  it('reserves in simulation mode and links a known outlet by host', async () => {
    const response = await startCheckout(order, deps);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      simulated: true,
      redirect: 'https://newsmap.example/advertise/thanks/?simulated=1',
    });
    const [slot] = await db.select().from(sponsorships);
    expect(slot).toMatchObject({ outlet_id: 'pt-a', status: 'reserved', slot_position: 1 });
    const full = await startCheckout(order, deps);
    expect(full.status).toBe(409);
  });

  it('sends the buyer to LemonSqueezy with the reservation deadline', async () => {
    const api = fakeFetch(() =>
      jsonResponse({ data: { attributes: { url: 'https://pay.example/c/9' } } }, 201),
    );
    const response = await startCheckout(order, {
      ...deps,
      lemonSqueezy: { apiKey: 'k', storeId: '1', fetcher: api.fetcher },
    });
    expect(await response.json()).toEqual({ redirect: 'https://pay.example/c/9' });
    const sent = JSON.parse(String(api.calls[0]?.init?.body));
    expect(sent.data.attributes.expires_at).toBe('2026-11-01T12:30:00.000Z');
  });

  it('refuses plans without a configured variant, bad input and bots', async () => {
    const live = { ...deps, lemonSqueezy: { apiKey: 'k', storeId: '1' } };
    expect((await startCheckout({ ...order, plan: 'yearly' }, live)).status).toBe(503);
    expect((await startCheckout({ ...order, plan: 'weekly' }, deps)).status).toBe(422);
    expect((await startCheckout(order, { ...deps, human: async () => false })).status).toBe(403);
  });
});

describe('admin actions', () => {
  const paid = async () => {
    await startCheckout(order, deps);
    const [submission] = await db.select().from(submissions).where(eq(submissions.plan, 'monthly'));
    await db
      .update(submissions)
      .set({ status: 'paid_pending_review', ls_order_id: '80', ls_subscription_id: '90' })
      .where(eq(submissions.id, submission!.id));
    await db
      .update(sponsorships)
      .set({ reserved_until: null })
      .where(eq(sponsorships.submission_id, submission!.id));
    return submission!.id;
  };

  it('approves a paid listing and makes the slot active', async () => {
    const id = await paid();
    expect(await runAction(db, 'approve', id, NOW, null)).toMatchObject({
      ok: true,
      rebuild: true,
    });
    expect((await db.select().from(sponsorships))[0]).toMatchObject({
      status: 'active',
      starts_at: NOW.toISOString(),
    });
    expect((await runAction(db, 'approve', id, NOW, null)).ok).toBe(false);
  });

  it('cannot approve when the hold was lost', async () => {
    const id = await paid();
    await db.update(sponsorships).set({ status: 'ended' });
    expect(await runAction(db, 'approve', id, NOW, null)).toMatchObject({
      ok: false,
      rebuild: false,
    });
  });

  it('rejects, cancels and refunds, and reports a failed refund', async () => {
    const id = await paid();
    const api = fakeFetch(
      (url) => new Response(null, { status: url.endsWith('/refund') ? 500 : 200 }),
    );
    const result = await runAction(db, 'reject', id, NOW, {
      apiKey: 'k',
      storeId: '1',
      fetcher: api.fetcher,
    });
    expect(result).toMatchObject({ ok: false, rebuild: false });
    expect(result.message).toMatch(/refund failed/);
    expect(api.calls.map((c) => c.init?.method)).toEqual(['DELETE', 'POST']);
    expect((await db.select().from(submissions))[0]?.status).toBe('rejected');
    expect((await runAction(db, 'reject', id, NOW, null)).ok).toBe(false);
  });

  it('rejects an approved listing with a successful refund and asks for a rebuild', async () => {
    const id = await paid();
    await runAction(db, 'approve', id, NOW, null);
    const api = fakeFetch(() => new Response(null, { status: 200 }));
    const result = await runAction(db, 'reject', id, NOW, {
      apiKey: 'k',
      storeId: '1',
      fetcher: api.fetcher,
    });
    expect(result).toMatchObject({ ok: true, rebuild: true, message: 'Rejected.' });
    expect((await db.select().from(submissions))[0]?.status).toBe('refunded');
  });

  it('closes suggestions and corrections and lists open work', async () => {
    await submitSuggestion(suggestion, deps);
    await submitCorrection(
      { outlet_id: 'pt-a', field: 'url', message: 'Moved.', turnstile_token: 't' },
      deps,
    );
    await paid();
    const before = await overview(db);
    expect(before.freeSuggestions).toHaveLength(1);
    expect(before.corrections).toHaveLength(1);
    expect(before.paidSubmissions).toHaveLength(1);
    expect(before.liveSponsorships).toHaveLength(1);
    expect(
      (await runAction(db, 'close-suggestion', before.freeSuggestions[0]!.id, NOW, null)).ok,
    ).toBe(true);
    expect(
      (await runAction(db, 'accept-correction', before.corrections[0]!.id, NOW, null)).ok,
    ).toBe(true);
    expect((await runAction(db, 'reject-correction', 'cor-missing', NOW, null)).ok).toBe(false);
    expect((await runAction(db, 'close-suggestion', 'sub-missing', NOW, null)).ok).toBe(false);
    const after = await overview(db);
    expect(after.freeSuggestions).toHaveLength(0);
    expect(after.corrections).toHaveLength(0);
  });
});

describe('toCsv', () => {
  it('quotes, escapes and neutralizes spreadsheet formulas', () => {
    expect(toCsv([])).toBe('');
    expect(toCsv([{ a: 'x,y', b: 'say "hi"', c: '=HYPERLINK("x")', d: null }])).toBe(
      'a,b,c,d\r\n"x,y","say ""hi""","\'=HYPERLINK(""x"")",\r\n',
    );
  });
});

describe('maintain', () => {
  it('ends lapsed listings and reservations and anonymizes old contacts', async () => {
    await startCheckout(order, deps);
    await submitCorrection(
      {
        outlet_id: 'pt-a',
        field: 'url',
        message: 'Moved.',
        contact_email: 'r@example.com',
        turnstile_token: 't',
      },
      deps,
    );
    const later = new Date('2029-01-01T00:00:00.000Z');
    await db
      .update(correctionRequests)
      .set({ status: 'accepted', closed_at: '2026-11-02T00:00:00.000Z' });

    const report = await maintain(db, later);
    expect(report).toEqual({ releasedReservations: 1, endedSponsorships: 0, anonymized: 1 });
    expect((await db.select().from(correctionRequests))[0]?.contact_email).toBeNull();
    // The released submission was closed at `later`, so it keeps its e-mail for 24 more months.
    expect((await db.select().from(submissions))[0]?.contact_email).toBe('billing@example.com');
    expect((await maintain(db, new Date('2031-02-01T00:00:00.000Z'))).anonymized).toBe(1);
  });

  it('ends cancelled and unpaid listings at their end date', async () => {
    await startCheckout(order, deps);
    await db
      .update(sponsorships)
      .set({ status: 'active', reserved_until: null, ends_at: '2026-11-10T00:00:00.000Z' });
    expect((await maintain(db, NOW)).endedSponsorships).toBe(0);
    expect((await maintain(db, new Date('2026-11-11T00:00:00.000Z'))).endedSponsorships).toBe(1);
    expect((await db.select().from(submissions))[0]?.closed_at).toBe('2026-11-11T00:00:00.000Z');
  });

  it('computes the retention cutoff in calendar months', () => {
    expect(retentionCutoff(new Date('2026-11-01T00:00:00.000Z'))).toBe('2024-11-01T00:00:00.000Z');
  });

  it('runs from the cron entry point', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runDailyMaintenance({ DB: createTestD1() } as unknown as Env);
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({
      event: 'maintenance',
      endedSponsorships: 0,
    });
    log.mockRestore();
  });
});
