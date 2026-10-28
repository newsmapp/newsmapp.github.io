import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const timestamps = {
  created_at: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
};

export const submissions = sqliteTable(
  'submissions',
  {
    id: text('id').primaryKey(),
    outlet_name: text('outlet_name').notNull(),
    url: text('url').notNull(),
    country_iso: text('country_iso').notNull(),
    category: text('category').notNull(),
    /** Anonymized 24 months after closure, or after creation if never closed (cron). */
    contact_email: text('contact_email'),
    note: text('note'),
    plan: text('plan', { enum: ['free', 'monthly', 'yearly'] }).notNull(),
    status: text('status', {
      enum: [
        'pending',
        'awaiting_payment',
        'paid_pending_review',
        'approved',
        'rejected',
        'refunded',
      ],
    }).notNull(),
    ls_order_id: text('ls_order_id'),
    ls_subscription_id: text('ls_subscription_id'),
    /** When LemonSqueezy confirmed the subscription cancelled (our call or its webhook). */
    cancelled_at: text('cancelled_at'),
    /** When LemonSqueezy confirmed the order refunded (our call or its webhook). */
    refunded_at: text('refunded_at'),
    ...timestamps,
    updated_at: text('updated_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    closed_at: text('closed_at'),
  },
  (t) => [index('submissions_status_idx').on(t.status)],
);

export const sponsorships = sqliteTable(
  'sponsorships',
  {
    id: text('id').primaryKey(),
    submission_id: text('submission_id')
      .notNull()
      .references(() => submissions.id),
    /** Null when the sponsored outlet is not in the catalog yet. */
    outlet_id: text('outlet_id'),
    outlet_name: text('outlet_name').notNull(),
    outlet_url: text('outlet_url').notNull(),
    country_iso: text('country_iso').notNull(),
    category: text('category').notNull(),
    slot_position: integer('slot_position').notNull(),
    status: text('status', { enum: ['reserved', 'active', 'grace', 'ended'] }).notNull(),
    reserved_until: text('reserved_until'),
    /** Daily keyed hash of the buyer's IP while an unpaid hold runs: one hold per visitor. */
    reserved_by: text('reserved_by'),
    starts_at: text('starts_at'),
    ends_at: text('ends_at'),
    ls_subscription_id: text('ls_subscription_id'),
    ...timestamps,
  },
  (t) => [
    // One live claim per slot: prevents selling the same slot twice.
    uniqueIndex('sponsorships_live_slot_uq')
      .on(t.country_iso, t.category, t.slot_position)
      .where(sql`status IN ('reserved', 'active', 'grace')`),
    index('sponsorships_status_idx').on(t.status),
    index('sponsorships_subscription_idx').on(t.ls_subscription_id),
  ],
);

export const webhookEvents = sqliteTable('webhook_events', {
  idempotency_key: text('idempotency_key').primaryKey(),
  event_name: text('event_name').notNull(),
  received_at: text('received_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export const correctionRequests = sqliteTable(
  'correction_requests',
  {
    id: text('id').primaryKey(),
    outlet_id: text('outlet_id').notNull(),
    field: text('field').notNull(),
    message: text('message').notNull(),
    contact_email: text('contact_email'),
    status: text('status', { enum: ['open', 'accepted', 'rejected'] }).notNull(),
    ...timestamps,
    closed_at: text('closed_at'),
  },
  (t) => [index('correction_requests_status_idx').on(t.status)],
);

export type Submission = typeof submissions.$inferSelect;
export type Sponsorship = typeof sponsorships.$inferSelect;
