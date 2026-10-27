import { and, eq, inArray } from 'drizzle-orm';
import { sponsorships, submissions, webhookEvents } from '../db/schema';
import { addDays, iso, isUniqueViolation, type Database } from './db';
import { idempotencyKey, type WebhookEvent } from './lemonsqueezy';

export const GRACE_DAYS = 7;

export interface WebhookOutcome {
  status: 'processed' | 'duplicate' | 'ignored';
  /** A listing visible on the site changed: the site needs a rebuild. */
  rebuild: boolean;
}

/** Applies a verified LemonSqueezy event to submissions and sponsorships (SPEC §3.6.1). */
export async function applyEvent(
  db: Database,
  event: WebhookEvent,
  now: Date,
): Promise<WebhookOutcome> {
  try {
    await db.insert(webhookEvents).values({
      idempotency_key: idempotencyKey(event),
      event_name: event.meta.event_name,
      received_at: iso(now),
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { status: 'duplicate', rebuild: false };
    throw error;
  }

  const attributes = event.data.attributes;
  const subscriptionId =
    event.data.type === 'subscriptions' ? event.data.id : String(attributes.subscription_id ?? '');
  const bySubscription = eq(sponsorships.ls_subscription_id, subscriptionId);
  const stamp = { updated_at: iso(now) };

  switch (event.meta.event_name) {
    case 'subscription_created': {
      const submissionId = event.meta.custom_data?.submission_id;
      if (!submissionId) return { status: 'ignored', rebuild: false };
      await db
        .update(submissions)
        .set({
          status: 'paid_pending_review',
          ls_subscription_id: event.data.id,
          ls_order_id: attributes.order_id === undefined ? null : String(attributes.order_id),
          closed_at: null,
          ...stamp,
        })
        .where(eq(submissions.id, submissionId));
      // Paid: the slot is held until the editor decides, even past the 30-minute window.
      try {
        await db
          .update(sponsorships)
          .set({
            status: 'reserved',
            reserved_until: null,
            ends_at: null,
            ls_subscription_id: event.data.id,
          })
          .where(
            and(
              eq(sponsorships.submission_id, submissionId),
              inArray(sponsorships.status, ['reserved', 'ended']),
            ),
          );
      } catch (error) {
        // The reservation lapsed and someone else took the slot: the editor sees it ended and refunds.
        if (!isUniqueViolation(error)) throw error;
        await db
          .update(sponsorships)
          .set({ ls_subscription_id: event.data.id })
          .where(eq(sponsorships.submission_id, submissionId));
      }
      return { status: 'processed', rebuild: false };
    }
    case 'subscription_payment_success':
    case 'subscription_updated': {
      if (attributes.status === 'cancelled' && attributes.ends_at) {
        await db.update(sponsorships).set({ ends_at: attributes.ends_at }).where(bySubscription);
        return { status: 'processed', rebuild: false };
      }
      if (event.meta.event_name === 'subscription_updated' && attributes.status !== 'active') {
        return { status: 'processed', rebuild: false };
      }
      const recovered = await db
        .update(sponsorships)
        .set({ status: 'active', ends_at: null })
        .where(and(bySubscription, eq(sponsorships.status, 'grace')))
        .returning({ id: sponsorships.id });
      return { status: 'processed', rebuild: recovered.length > 0 };
    }
    case 'subscription_payment_failed': {
      await db
        .update(sponsorships)
        .set({ status: 'grace', ends_at: iso(addDays(now, GRACE_DAYS)) })
        .where(and(bySubscription, eq(sponsorships.status, 'active')));
      return { status: 'processed', rebuild: false };
    }
    case 'subscription_cancelled': {
      // Stays listed until the paid period ends; the daily cron ends it then.
      await db
        .update(sponsorships)
        .set({ ends_at: attributes.ends_at ?? iso(now) })
        .where(and(bySubscription, inArray(sponsorships.status, ['active', 'grace', 'reserved'])));
      return { status: 'processed', rebuild: false };
    }
    case 'subscription_expired': {
      const ended = await db
        .update(sponsorships)
        .set({ status: 'ended', ends_at: iso(now) })
        .where(and(bySubscription, inArray(sponsorships.status, ['active', 'grace', 'reserved'])))
        .returning({ status: sponsorships.status });
      await db
        .update(submissions)
        .set({ closed_at: iso(now), ...stamp })
        .where(eq(submissions.ls_subscription_id, subscriptionId));
      return { status: 'processed', rebuild: ended.length > 0 };
    }
    case 'order_refunded': {
      const refunded = await db
        .update(submissions)
        .set({ status: 'refunded', closed_at: iso(now), ...stamp })
        .where(eq(submissions.ls_order_id, event.data.id))
        .returning({ id: submissions.id });
      if (refunded.length === 0) return { status: 'ignored', rebuild: false };
      const ended = await db
        .update(sponsorships)
        .set({ status: 'ended', ends_at: iso(now) })
        .where(
          and(
            inArray(
              sponsorships.submission_id,
              refunded.map((r) => r.id),
            ),
            inArray(sponsorships.status, ['active', 'grace', 'reserved']),
          ),
        )
        .returning({ id: sponsorships.id });
      return { status: 'processed', rebuild: ended.length > 0 };
    }
    default:
      return { status: 'ignored', rebuild: false };
  }
}
