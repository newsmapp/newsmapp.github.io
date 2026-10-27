import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { correctionRequests, sponsorships, submissions } from '../db/schema';
import { iso, type Database } from './db';
import { cancelSubscription, refundOrder, type LemonSqueezyConfig } from './lemonsqueezy';

export type AdminAction =
  'approve' | 'reject' | 'close-suggestion' | 'accept-correction' | 'reject-correction';

export interface ActionResult {
  ok: boolean;
  message: string;
  rebuild: boolean;
}

/**
 * Editor decisions. Approving a paid submission makes its slot active; rejecting ends the slot,
 * cancels the subscription and refunds the order in full.
 */
export async function runAction(
  db: Database,
  action: AdminAction,
  id: string,
  now: Date,
  lemonSqueezy: LemonSqueezyConfig | null,
): Promise<ActionResult> {
  const closed = { closed_at: iso(now) };
  switch (action) {
    case 'approve': {
      const [submission] = await db.select().from(submissions).where(eq(submissions.id, id));
      if (submission?.status !== 'paid_pending_review')
        return { ok: false, message: 'Not awaiting review.', rebuild: false };
      const activated = await db
        .update(sponsorships)
        .set({ status: 'active', starts_at: iso(now), reserved_until: null })
        .where(and(eq(sponsorships.submission_id, id), eq(sponsorships.status, 'reserved')))
        .returning({ id: sponsorships.id });
      if (activated.length === 0) {
        return {
          ok: false,
          message: 'The slot is no longer held. Reject and refund instead.',
          rebuild: false,
        };
      }
      await db
        .update(submissions)
        .set({ status: 'approved', updated_at: iso(now) })
        .where(eq(submissions.id, id));
      return {
        ok: true,
        message: 'Approved. The listing goes live with the next build.',
        rebuild: true,
      };
    }
    case 'reject': {
      const [submission] = await db.select().from(submissions).where(eq(submissions.id, id));
      // A rejected submission that still holds payment ids had a refund fail: Reject retries it.
      const retry =
        submission?.status === 'rejected' &&
        (submission.ls_subscription_id !== null || submission.ls_order_id !== null);
      if (!submission || (['rejected', 'refunded'].includes(submission.status) && !retry)) {
        return { ok: false, message: 'Already closed.', rebuild: false };
      }
      // A failed provider call (error answer or network) is reported to the editor; the listing
      // and the submission are closed together either way, so the site and the admin agree.
      const failed = () => false;
      let cancelled = true;
      let refunded = false;
      if (lemonSqueezy && submission.ls_subscription_id)
        cancelled = await cancelSubscription(lemonSqueezy, submission.ls_subscription_id).catch(
          failed,
        );
      if (lemonSqueezy && submission.ls_order_id)
        refunded = await refundOrder(lemonSqueezy, submission.ls_order_id).catch(failed);
      const [wasLive] = await db.batch([
        db
          .update(sponsorships)
          .set({ status: 'ended', ends_at: iso(now) })
          .where(and(eq(sponsorships.submission_id, id), ne(sponsorships.status, 'ended')))
          .returning({ status: sponsorships.status }),
        db
          .update(submissions)
          .set({ status: refunded ? 'refunded' : 'rejected', updated_at: iso(now), ...closed })
          .where(eq(submissions.id, id)),
      ]);
      const refundFailed = lemonSqueezy !== null && submission.ls_order_id !== null && !refunded;
      const failures = [
        ...(cancelled ? [] : ['cancelling the subscription']),
        ...(refundFailed ? ['the refund'] : []),
      ];
      return {
        ok: failures.length === 0,
        message:
          failures.length === 0
            ? 'Rejected.'
            : `Rejected, but ${failures.join(' and ')} failed. Finish it in the LemonSqueezy dashboard.`,
        rebuild: wasLive.length > 0 && submission.status === 'approved',
      };
    }
    case 'close-suggestion': {
      const updated = await db
        .update(submissions)
        .set({ status: 'rejected', updated_at: iso(now), ...closed })
        .where(and(eq(submissions.id, id), eq(submissions.plan, 'free')))
        .returning({ id: submissions.id });
      return {
        ok: updated.length > 0,
        message: updated.length ? 'Suggestion closed.' : 'Not found.',
        rebuild: false,
      };
    }
    case 'accept-correction':
    case 'reject-correction': {
      const updated = await db
        .update(correctionRequests)
        .set({ status: action === 'accept-correction' ? 'accepted' : 'rejected', ...closed })
        .where(eq(correctionRequests.id, id))
        .returning({ id: correctionRequests.id });
      return {
        ok: updated.length > 0,
        message: updated.length ? 'Correction closed.' : 'Not found.',
        rebuild: false,
      };
    }
  }
}

/** Everything the admin page lists, newest first. */
export async function overview(db: Database) {
  const [paidSubmissions, freeSuggestions, liveSponsorships, corrections] = await Promise.all([
    db
      .select()
      .from(submissions)
      .where(inArray(submissions.plan, ['monthly', 'yearly']))
      .orderBy(desc(submissions.created_at))
      .limit(100),
    db
      .select()
      .from(submissions)
      .where(and(eq(submissions.plan, 'free'), eq(submissions.status, 'pending')))
      .orderBy(desc(submissions.created_at))
      .limit(100),
    db
      .select()
      .from(sponsorships)
      .where(inArray(sponsorships.status, ['reserved', 'active', 'grace']))
      .orderBy(sponsorships.country_iso, sponsorships.category, sponsorships.slot_position),
    db
      .select()
      .from(correctionRequests)
      .where(eq(correctionRequests.status, 'open'))
      .orderBy(desc(correctionRequests.created_at))
      .limit(100),
  ]);
  return { paidSubmissions, freeSuggestions, liveSponsorships, corrections };
}

export const EXPORTS = ['submissions', 'sponsorships', 'corrections'] as const;
export type ExportType = (typeof EXPORTS)[number];

/** Whole tables for the CSV export, newest first: unlike overview(), nothing is left out. */
export function exportRows(db: Database, type: ExportType): Promise<Record<string, unknown>[]> {
  switch (type) {
    case 'submissions':
      return db.select().from(submissions).orderBy(desc(submissions.created_at));
    case 'sponsorships':
      return db.select().from(sponsorships).orderBy(desc(sponsorships.created_at));
    case 'corrections':
      return db.select().from(correctionRequests).orderBy(desc(correctionRequests.created_at));
  }
}

/** RFC 4180 CSV; cells starting with = + - @ are prefixed so spreadsheets do not run them. */
export function toCsv(rows: readonly Record<string, unknown>[]): string {
  const first = rows[0];
  if (!first) return '';
  const columns = Object.keys(first);
  const cell = (value: unknown): string => {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return (
    [columns.join(','), ...rows.map((row) => columns.map((c) => cell(row[c])).join(','))].join(
      '\r\n',
    ) + '\r\n'
  );
}
