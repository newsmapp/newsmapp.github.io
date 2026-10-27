import { and, eq, inArray, sql } from 'drizzle-orm';
import { sponsorships, submissions, webhookEvents } from '../db/schema';
import { addDays, iso, isUniqueViolation, type Database } from './db';
import {
  cancelSubscription,
  idempotencyKey,
  refundOrder,
  type LemonSqueezyConfig,
  type WebhookEvent,
} from './lemonsqueezy';

export const GRACE_DAYS = 7;

export interface WebhookOutcome {
  status: 'processed' | 'duplicate' | 'ignored';
  /** A listing visible on the site changed: the site needs a rebuild. */
  rebuild: boolean;
  /** A payment that no open checkout is waiting for: it is cancelled and refunded. */
  unwanted?: UnwantedPayment;
}

export interface UnwantedPayment {
  /** Null when the submission is unknown or still has a payment of its own. */
  submissionId: string | null;
  subscriptionId: string;
  orderId: string | null;
}

const DUPLICATE: WebhookOutcome = { status: 'duplicate', rebuild: false };

async function seen(db: Database, key: string): Promise<boolean> {
  const [row] = await db
    .select({ key: webhookEvents.idempotency_key })
    .from(webhookEvents)
    .where(eq(webhookEvents.idempotency_key, key));
  return row !== undefined;
}

/**
 * Applies a verified LemonSqueezy event to submissions and sponsorships (SPEC §3.6.1).
 * The idempotency row is written in the same batch as the changes, so an event that fails
 * half-way is retried by LemonSqueezy instead of being taken for a duplicate.
 */
export async function applyEvent(
  db: Database,
  event: WebhookEvent,
  now: Date,
): Promise<WebhookOutcome> {
  const key = idempotencyKey(event);
  if (await seen(db, key)) return DUPLICATE;
  try {
    return await processEvent(db, event, now, key);
  } catch (error) {
    // A concurrent delivery of the same event won the insert.
    if (isUniqueViolation(error) && (await seen(db, key))) return DUPLICATE;
    throw error;
  }
}

async function processEvent(
  db: Database,
  event: WebhookEvent,
  now: Date,
  key: string,
): Promise<WebhookOutcome> {
  const record = db.insert(webhookEvents).values({
    idempotency_key: key,
    event_name: event.meta.event_name,
    received_at: iso(now),
  });
  const ignored = async (): Promise<WebhookOutcome> => {
    await record;
    return { status: 'ignored', rebuild: false };
  };
  const attributes = event.data.attributes;
  const subscriptionId =
    event.data.type === 'subscriptions' ? event.data.id : String(attributes.subscription_id ?? '');
  const bySubscription = eq(sponsorships.ls_subscription_id, subscriptionId);
  const stamp = { updated_at: iso(now) };

  switch (event.meta.event_name) {
    case 'subscription_created': {
      const submissionId = event.meta.custom_data?.submission_id;
      if (!submissionId) return ignored();
      // Only a checkout still waiting for payment is moved forward: a late or replayed event
      // must not reopen a submission the editor already rejected or refunded. The buyer was
      // charged all the same, so that payment is handed back for a refund.
      const [submission] = await db
        .select({ status: submissions.status, subscription: submissions.ls_subscription_id })
        .from(submissions)
        .where(eq(submissions.id, submissionId));
      // The same subscription delivered again (a resend carries a newer updated_at, so it passes
      // the idempotency key) is the payment already applied, not a second one to refund.
      if (submission?.subscription === event.data.id) return ignored();
      const orderId = attributes.order_id === undefined ? null : String(attributes.order_id);
      if (submission?.status !== 'awaiting_payment') {
        const closed = submission?.status === 'rejected' || submission?.status === 'refunded';
        // A closed submission keeps the payment ids, so the editor can retry a failed refund.
        if (closed) {
          await db.batch([
            record,
            db
              .update(submissions)
              .set({
                status: 'rejected',
                ls_subscription_id: event.data.id,
                ls_order_id: orderId,
                ...stamp,
              })
              .where(eq(submissions.id, submissionId)),
          ]);
        } else await record;
        return {
          status: 'processed',
          rebuild: false,
          unwanted: {
            submissionId: closed ? submissionId : null,
            subscriptionId: event.data.id,
            orderId,
          },
        };
      }
      const awaiting = and(
        eq(submissions.id, submissionId),
        eq(submissions.status, 'awaiting_payment'),
      );
      const markPaid = db
        .update(submissions)
        .set({
          status: 'paid_pending_review',
          ls_subscription_id: event.data.id,
          ls_order_id: orderId,
          closed_at: null,
          ...stamp,
        })
        .where(awaiting);
      const ofPendingSubmission = and(
        eq(sponsorships.submission_id, submissionId),
        sql`EXISTS (SELECT 1 FROM submissions WHERE id = ${submissionId} AND status = 'awaiting_payment')`,
      );
      try {
        // Paid: the slot is held until the editor decides, even past the 30-minute window.
        // The slot update runs first, while the submission still reads awaiting_payment.
        await db.batch([
          record,
          db
            .update(sponsorships)
            .set({
              status: 'reserved',
              reserved_until: null,
              reserved_by: null,
              ends_at: null,
              ls_subscription_id: event.data.id,
            })
            .where(and(ofPendingSubmission, inArray(sponsorships.status, ['reserved', 'ended']))),
          markPaid,
        ]);
      } catch (error) {
        if (!isUniqueViolation(error) || (await seen(db, key))) throw error;
        // The reservation lapsed and someone else took the slot: the editor sees it ended and refunds.
        await db.batch([
          record,
          db
            .update(sponsorships)
            .set({ ls_subscription_id: event.data.id, reserved_by: null })
            .where(ofPendingSubmission),
          markPaid,
        ]);
      }
      return { status: 'processed', rebuild: false };
    }
    case 'subscription_payment_success':
    case 'subscription_updated': {
      if (attributes.status === 'cancelled' && attributes.ends_at) {
        await db.batch([
          record,
          db.update(sponsorships).set({ ends_at: attributes.ends_at }).where(bySubscription),
        ]);
        return { status: 'processed', rebuild: false };
      }
      if (event.meta.event_name === 'subscription_updated' && attributes.status !== 'active') {
        await record;
        return { status: 'processed', rebuild: false };
      }
      // A listing in grace is restored by a payment or an active subscription. Only
      // subscription_updated carries the subscription status (payment events carry the
      // invoice's), so only it clears the end date of a resumed subscription: a late payment
      // event must not undo a cancellation.
      const resumed =
        event.meta.event_name === 'subscription_updated'
          ? [
              db
                .update(sponsorships)
                .set({ ends_at: null })
                .where(and(bySubscription, eq(sponsorships.status, 'active'))),
            ]
          : [];
      const [, recovered] = await db.batch([
        record,
        db
          .update(sponsorships)
          .set({ status: 'active', ends_at: null })
          .where(and(bySubscription, eq(sponsorships.status, 'grace')))
          .returning({ id: sponsorships.id }),
        ...resumed,
      ]);
      return { status: 'processed', rebuild: recovered.length > 0 };
    }
    case 'subscription_payment_failed': {
      await db.batch([
        record,
        db
          .update(sponsorships)
          .set({ status: 'grace', ends_at: iso(addDays(now, GRACE_DAYS)) })
          .where(and(bySubscription, eq(sponsorships.status, 'active'))),
      ]);
      return { status: 'processed', rebuild: false };
    }
    case 'subscription_cancelled': {
      // Stays listed until the paid period ends; the daily cron ends it then.
      await db.batch([
        record,
        db
          .update(sponsorships)
          .set({ ends_at: attributes.ends_at ?? iso(now) })
          .where(
            and(bySubscription, inArray(sponsorships.status, ['active', 'grace', 'reserved'])),
          ),
      ]);
      return { status: 'processed', rebuild: false };
    }
    case 'subscription_expired': {
      const [, ended] = await db.batch([
        record,
        db
          .update(sponsorships)
          .set({ status: 'ended', ends_at: iso(now) })
          .where(and(bySubscription, inArray(sponsorships.status, ['active', 'grace', 'reserved'])))
          .returning({ status: sponsorships.status }),
        db
          .update(submissions)
          .set({ closed_at: iso(now), ...stamp })
          .where(eq(submissions.ls_subscription_id, subscriptionId)),
      ]);
      return { status: 'processed', rebuild: ended.length > 0 };
    }
    case 'order_refunded': {
      const byOrder = eq(submissions.ls_order_id, event.data.id);
      const [, refunded, ended] = await db.batch([
        record,
        db
          .update(submissions)
          .set({ status: 'refunded', closed_at: iso(now), ...stamp })
          .where(byOrder)
          .returning({ id: submissions.id }),
        db
          .update(sponsorships)
          .set({ status: 'ended', ends_at: iso(now) })
          .where(
            and(
              sql`${sponsorships.submission_id} IN (SELECT id FROM submissions WHERE ls_order_id = ${event.data.id})`,
              inArray(sponsorships.status, ['active', 'grace', 'reserved']),
            ),
          )
          .returning({ id: sponsorships.id }),
      ]);
      if (refunded.length === 0) return { status: 'ignored', rebuild: false };
      return { status: 'processed', rebuild: ended.length > 0 };
    }
    default:
      return ignored();
  }
}

/**
 * Cancels and refunds a payment no checkout was waiting for (see UnwantedPayment). A submission
 * is marked refunded only when both calls succeed; otherwise it stays rejected with its payment
 * ids, and the admin lists it for a retry.
 */
export async function settleUnwanted(
  db: Database,
  config: LemonSqueezyConfig,
  unwanted: UnwantedPayment,
  now: Date,
): Promise<boolean> {
  const failed = () => false;
  const cancelled = await cancelSubscription(config, unwanted.subscriptionId).catch(failed);
  const refunded = unwanted.orderId
    ? await refundOrder(config, unwanted.orderId).catch(failed)
    : true;
  const settled = cancelled && refunded;
  if (!settled) console.error(`Unwanted payment ${unwanted.subscriptionId} needs a manual refund.`);
  else if (unwanted.submissionId)
    await db
      .update(submissions)
      .set({ status: 'refunded', closed_at: iso(now), updated_at: iso(now) })
      .where(eq(submissions.id, unwanted.submissionId));
  return settled;
}
