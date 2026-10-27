import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { sponsorships, submissions } from '@/db/schema';
import type { Pricing } from '@/lib/monetization/pricing';
import type { Database } from '@/server/db';
import { hmacSha256, toHex } from '@/server/crypto';
import {
  acceptsEvent,
  cancelSubscription,
  createCheckout,
  idempotencyKey,
  parseEvent,
  refundOrder,
  verifySignature,
  type WebhookEvent,
} from '@/server/lemonsqueezy';
import { reserveSlot } from '@/server/sponsorships';
import { applyEvent, settleUnwanted } from '@/server/webhooks';
import { testEvent } from '../../tools/lemonsqueezy-simulate';
import { NOW, fakeFetch, jsonResponse, testDb } from '../helpers/server';

const config = (fetcher: typeof fetch) => ({ apiKey: 'key', storeId: '42', fetcher });

describe('LemonSqueezy client', () => {
  it('verifies the hex HMAC of the raw body', async () => {
    const body = '{"meta":{}}';
    const signature = toHex(await hmacSha256('whsec', body));
    expect(await verifySignature(body, signature, 'whsec')).toBe(true);
    expect(await verifySignature(body, signature.toUpperCase(), 'whsec')).toBe(true);
    expect(await verifySignature(`${body} `, signature, 'whsec')).toBe(false);
    expect(await verifySignature(body, null, 'whsec')).toBe(false);
    expect(await verifySignature(body, signature, '')).toBe(false);
  });

  it('creates a checkout carrying the submission id', async () => {
    const api = fakeFetch(() =>
      jsonResponse({ data: { attributes: { url: 'https://pay.example/c/1' } } }, 201),
    );
    const url = await createCheckout(config(api.fetcher), {
      variantId: '7',
      email: 'billing@example.com',
      submissionId: 'sub-1',
      redirectUrl: 'https://newsmap.example/advertise/thanks/',
      expiresAt: '2026-11-01T12:30:00.000Z',
    });
    expect(url).toBe('https://pay.example/c/1');
    const sent = JSON.parse(String(api.calls[0]?.init?.body));
    expect(sent.data.attributes.checkout_data.custom).toEqual({ submission_id: 'sub-1' });
    expect(sent.data.relationships.variant.data.id).toBe('7');
    expect((api.calls[0]?.init?.headers as Record<string, string>).authorization).toBe(
      'Bearer key',
    );
  });

  it('fails loudly when the checkout cannot be created', async () => {
    const down = fakeFetch(() => new Response('', { status: 422 }));
    const empty = fakeFetch(() => jsonResponse({ data: {} }));
    const request = {
      variantId: '7',
      email: 'a@example.com',
      submissionId: 's',
      redirectUrl: 'https://x.example/',
      expiresAt: '',
    };
    await expect(createCheckout(config(down.fetcher), request)).rejects.toThrow(/HTTP 422/);
    await expect(createCheckout(config(empty.fetcher), request)).rejects.toThrow(/no URL/);
  });

  it('refunds orders and cancels subscriptions', async () => {
    const api = fakeFetch(() => new Response(null, { status: 200 }));
    expect(await refundOrder(config(api.fetcher), '80')).toBe(true);
    expect(await cancelSubscription(config(api.fetcher), '90')).toBe(true);
    expect(api.calls.map((c) => [c.init?.method, c.url])).toEqual([
      ['POST', 'https://api.lemonsqueezy.com/v1/orders/80/refund'],
      ['DELETE', 'https://api.lemonsqueezy.com/v1/subscriptions/90'],
    ]);
  });

  it('parses events defensively', () => {
    expect(parseEvent('nope')).toBeNull();
    expect(parseEvent('{"meta":{}}')).toBeNull();
    const event = parseEvent('{"meta":{"event_name":"x"},"data":{"type":"orders","id":"1"}}');
    expect(event?.data.attributes).toEqual({});
    expect(idempotencyKey(event!)).toBe('x:1:');
  });

  it('applies test-mode events only when the owner opted in', () => {
    const live = parseEvent('{"meta":{"event_name":"x"},"data":{"type":"orders","id":"1"}}')!;
    const test = { ...live, meta: { ...live.meta, test_mode: true } };
    expect(acceptsEvent(live, false)).toBe(true);
    expect(acceptsEvent(test, false)).toBe(false);
    expect(acceptsEvent(test, true)).toBe(true);
  });
});

describe('applyEvent', () => {
  let db: Database;
  let submissionId: string;
  const event = (name: Parameters<typeof testEvent>[0], at = NOW) =>
    testEvent(name, submissionId, at) as WebhookEvent;
  const sponsorship = async () =>
    (await db.select().from(sponsorships).where(eq(sponsorships.submission_id, submissionId)))[0];
  const submission = async () =>
    (await db.select().from(submissions).where(eq(submissions.id, submissionId)))[0];

  beforeEach(async () => {
    db = testDb();
    const reservation = await reserveSlot(
      db,
      {
        outlet_name: 'Example Daily',
        url: 'https://daily.example.com/',
        country_iso: 'PT',
        category: 'sports',
        contact_email: 'billing@example.com',
        plan: 'monthly',
        outlet_id: null,
        holder: null,
      },
      3,
      NOW,
    );
    submissionId = reservation!.submissionId;
  });

  it('holds the slot once paid and ignores exact replays', async () => {
    const created = event('subscription_created');
    expect(await applyEvent(db, created, NOW)).toEqual({ status: 'processed', rebuild: false });
    expect(await applyEvent(db, created, NOW)).toEqual({ status: 'duplicate', rebuild: false });
    expect((await submission())?.status).toBe('paid_pending_review');
    expect(await sponsorship()).toMatchObject({ status: 'reserved', reserved_until: null });
  });

  it('never refunds the applied subscription when it is delivered again later', async () => {
    await applyEvent(db, event('subscription_created'), NOW);
    const later = new Date(NOW.getTime() + 60_000);
    expect(await applyEvent(db, event('subscription_created', later), later)).toEqual({
      status: 'ignored',
      rebuild: false,
    });
    expect((await submission())?.status).toBe('paid_pending_review');
  });

  it('retries an event that failed half-way instead of calling it a duplicate', async () => {
    const created = event('subscription_created');
    const batch = db.batch.bind(db);
    db.batch = (async () => {
      throw new Error('D1 unavailable');
    }) as typeof db.batch;
    await expect(applyEvent(db, created, NOW)).rejects.toThrow(/D1 unavailable/);
    db.batch = batch;
    expect((await submission())?.status).toBe('awaiting_payment');
    expect(await applyEvent(db, created, NOW)).toEqual({ status: 'processed', rebuild: false });
    expect((await submission())?.status).toBe('paid_pending_review');
  });

  it('does not reopen a rejected submission on a late subscription_created', async () => {
    await db
      .update(submissions)
      .set({ status: 'rejected', closed_at: NOW.toISOString() })
      .where(eq(submissions.id, submissionId));
    await db
      .update(sponsorships)
      .set({ status: 'ended' })
      .where(eq(sponsorships.submission_id, submissionId));
    const created = event('subscription_created');
    const outcome = await applyEvent(db, created, NOW);
    expect(outcome).toMatchObject({
      status: 'processed',
      rebuild: false,
      unwanted: { submissionId, subscriptionId: created.data.id },
    });
    // Still closed, but the payment it received is kept for the refund.
    expect(await submission()).toMatchObject({
      status: 'rejected',
      ls_subscription_id: created.data.id,
      ls_order_id: outcome.unwanted?.orderId,
    });
    expect(await sponsorship()).toMatchObject({ status: 'ended', ls_subscription_id: null });

    const down = fakeFetch(() => new Response(null, { status: 500 }));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await settleUnwanted(db, config(down.fetcher), outcome.unwanted!, NOW)).toBe(false);
    error.mockRestore();
    expect((await submission())?.status).toBe('rejected');
    const api = fakeFetch(() => new Response(null, { status: 200 }));
    expect(await settleUnwanted(db, config(api.fetcher), outcome.unwanted!, NOW)).toBe(true);
    expect(api.calls.map((c) => c.init?.method)).toEqual(['DELETE', 'POST']);
    expect((await submission())?.status).toBe('refunded');
  });

  it('hands back a payment for an unknown submission without touching any row', async () => {
    const stray = testEvent('subscription_created', 'sub-unknown', NOW) as WebhookEvent;
    const outcome = await applyEvent(db, stray, NOW);
    expect(outcome.unwanted).toMatchObject({ submissionId: null, subscriptionId: stray.data.id });
    expect((await submission())?.status).toBe('awaiting_payment');
  });

  it('hands back a payment for another tier or plan, and applies the right one', async () => {
    const pricing: Pricing = {
      currency: 'USD',
      default_tier: 1,
      tiers: [
        {
          tier: 1,
          countries: ['PT'],
          monthly: 29,
          yearly: 249,
          variant_ids: { monthly: '11', yearly: '12' },
        },
        {
          tier: 3,
          countries: ['BR'],
          monthly: 9,
          yearly: 79,
          variant_ids: { monthly: '31', yearly: '32' },
        },
      ],
      slots_per_category: 3,
    };
    const paid = (variant: string, second: number) => {
      const created = event('subscription_created', new Date(NOW.getTime() + second * 1000));
      return {
        ...created,
        data: {
          ...created.data,
          id: `${created.data.id}${second}`,
          attributes: { ...created.data.attributes, variant_id: Number(variant) },
        },
      };
    };
    for (const [variant, second] of [
      ['31', 1],
      ['12', 2],
    ] as const) {
      const outcome = await applyEvent(db, paid(variant, second), NOW, pricing);
      expect(outcome.unwanted).toMatchObject({ submissionId: null });
      expect((await submission())?.status).toBe('awaiting_payment');
    }
    const outcome = await applyEvent(db, paid('11', 3), NOW, pricing);
    expect(outcome).toEqual({ status: 'processed', rebuild: false });
    expect((await submission())?.status).toBe('paid_pending_review');
  });

  it('does not let a late payment event undo a cancellation', async () => {
    await applyEvent(db, event('subscription_created'), NOW);
    await db
      .update(sponsorships)
      .set({ status: 'active' })
      .where(eq(sponsorships.submission_id, submissionId));
    await applyEvent(db, event('subscription_cancelled', new Date(NOW.getTime() + 1000)), NOW);
    const endsAt = (await sponsorship())?.ends_at;
    expect(endsAt).not.toBeNull();
    await applyEvent(
      db,
      event('subscription_payment_success', new Date(NOW.getTime() + 2000)),
      NOW,
    );
    expect(await sponsorship()).toMatchObject({ status: 'active', ends_at: endsAt });
  });

  it('keeps a lapsed slot ended when someone else took it meanwhile', async () => {
    await db
      .update(sponsorships)
      .set({ status: 'ended' })
      .where(eq(sponsorships.submission_id, submissionId));
    await reserveSlot(
      db,
      {
        outlet_name: 'Other',
        url: 'https://other.example.com/',
        country_iso: 'PT',
        category: 'sports',
        contact_email: 'o@example.com',
        plan: 'monthly',
        outlet_id: null,
        holder: null,
      },
      1,
      NOW,
    );
    await applyEvent(db, event('subscription_created'), NOW);
    expect(await sponsorship()).toMatchObject({
      status: 'ended',
      ls_subscription_id: expect.any(String),
    });
  });

  it('runs the payment lifecycle: grace, recovery, cancellation and expiry', async () => {
    await applyEvent(db, event('subscription_created'), NOW);
    await db
      .update(sponsorships)
      .set({ status: 'active' })
      .where(eq(sponsorships.submission_id, submissionId));

    await applyEvent(db, event('subscription_payment_failed', new Date(NOW.getTime() + 1000)), NOW);
    expect(await sponsorship()).toMatchObject({
      status: 'grace',
      ends_at: '2026-11-08T12:00:00.000Z',
    });

    const recovered = await applyEvent(
      db,
      event('subscription_payment_success', new Date(NOW.getTime() + 2000)),
      NOW,
    );
    expect(recovered.rebuild).toBe(true);
    expect(await sponsorship()).toMatchObject({ status: 'active', ends_at: null });

    await applyEvent(db, event('subscription_cancelled', new Date(NOW.getTime() + 3000)), NOW);
    expect((await sponsorship())?.status).toBe('active');
    expect((await sponsorship())?.ends_at).not.toBeNull();

    const expired = await applyEvent(
      db,
      event('subscription_expired', new Date(NOW.getTime() + 4000)),
      NOW,
    );
    expect(expired.rebuild).toBe(true);
    expect((await sponsorship())?.status).toBe('ended');
    expect((await submission())?.closed_at).toBe(NOW.toISOString());
  });

  it('handles subscription_updated by status', async () => {
    await applyEvent(db, event('subscription_created'), NOW);
    const updated = (status: string, ends_at: string | null, ms: number): WebhookEvent => {
      const base = event('subscription_updated' as never, new Date(NOW.getTime() + ms));
      return {
        ...base,
        meta: { ...base.meta, event_name: 'subscription_updated' },
        data: { ...base.data, attributes: { ...base.data.attributes, status, ends_at } },
      };
    };
    expect(await applyEvent(db, updated('past_due', null, 1), NOW)).toEqual({
      status: 'processed',
      rebuild: false,
    });
    await applyEvent(db, updated('cancelled', '2026-12-01T00:00:00.000Z', 2), NOW);
    expect((await sponsorship())?.ends_at).toBe('2026-12-01T00:00:00.000Z');
    expect((await applyEvent(db, updated('active', null, 3), NOW)).rebuild).toBe(false);
  });

  it('keeps a resumed subscription listed past its old cancellation date', async () => {
    await applyEvent(db, event('subscription_created'), NOW);
    await db
      .update(sponsorships)
      .set({ status: 'active' })
      .where(eq(sponsorships.submission_id, submissionId));
    const base = event('subscription_cancelled', new Date(NOW.getTime() + 1000));
    const withStatus = (status: string, ends_at: string | null, ms: number): WebhookEvent => ({
      meta: { ...base.meta, event_name: 'subscription_updated' },
      data: {
        ...base.data,
        attributes: { status, ends_at, updated_at: new Date(NOW.getTime() + ms).toISOString() },
      },
    });
    await applyEvent(db, withStatus('cancelled', '2026-11-30T00:00:00.000Z', 2000), NOW);
    expect((await sponsorship())?.ends_at).toBe('2026-11-30T00:00:00.000Z');
    await applyEvent(db, withStatus('active', null, 3000), NOW);
    expect(await sponsorship()).toMatchObject({ status: 'active', ends_at: null });
  });

  it('ends the listing on refund and ignores unknown orders and events', async () => {
    await applyEvent(db, event('subscription_created'), NOW);
    const refund = await applyEvent(db, event('order_refunded'), NOW);
    expect(refund).toEqual({ status: 'processed', rebuild: true });
    expect((await submission())?.status).toBe('refunded');
    expect((await sponsorship())?.status).toBe('ended');

    const stranger = {
      meta: { event_name: 'order_refunded' },
      data: { type: 'orders', id: 'nope', attributes: {} },
    };
    expect((await applyEvent(db, stranger, NOW)).status).toBe('ignored');
    const other = {
      meta: { event_name: 'license_key_created' },
      data: { type: 'x', id: '1', attributes: {} },
    };
    expect((await applyEvent(db, other, NOW)).status).toBe('ignored');
    const orphan = {
      meta: { event_name: 'subscription_created' },
      data: { type: 'subscriptions', id: '5', attributes: {} },
    };
    expect((await applyEvent(db, orphan, NOW)).status).toBe('ignored');
  });
});
