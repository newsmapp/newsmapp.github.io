import { and, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { correctionRequests, sponsorships, submissions } from '../db/schema';
import { database, iso, type Database } from './db';
import { dispatchRebuild } from './rebuild';
import { releaseExpiredReservations } from './sponsorships';

export const RETENTION_MONTHS = 24;

export interface MaintenanceReport {
  releasedReservations: number;
  endedSponsorships: number;
  anonymized: number;
}

/**
 * Contact e-mails are anonymized 24 months after the request was closed (SPEC §3.7), or 24 months
 * after it was sent when an editor never closed it.
 */
export const retentionCutoff = (now: Date): string => {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RETENTION_MONTHS);
  return iso(cutoff);
};

export async function maintain(db: Database, now: Date): Promise<MaintenanceReport> {
  const releasedReservations = await releaseExpiredReservations(db, now);

  // Cancelled listings run until the paid period ends; grace ends after 7 days unpaid.
  const ended = await db
    .update(sponsorships)
    .set({ status: 'ended' })
    .where(
      and(
        inArray(sponsorships.status, ['active', 'grace']),
        isNotNull(sponsorships.ends_at),
        lt(sponsorships.ends_at, iso(now)),
      ),
    )
    .returning({ submission_id: sponsorships.submission_id });
  if (ended.length > 0) {
    await db
      .update(submissions)
      .set({ closed_at: iso(now), updated_at: iso(now) })
      .where(
        inArray(
          submissions.id,
          ended.map((e) => e.submission_id),
        ),
      );
  }

  const cutoff = retentionCutoff(now);
  const anonymizedSubmissions = await db
    .update(submissions)
    .set({ contact_email: null })
    .where(
      and(
        isNotNull(submissions.contact_email),
        or(
          and(isNotNull(submissions.closed_at), lt(submissions.closed_at, cutoff)),
          // Free suggestions nobody closed. Paid ones stay: a running listing has no closed_at.
          and(
            isNull(submissions.closed_at),
            eq(submissions.status, 'pending'),
            lt(submissions.created_at, cutoff),
          ),
        ),
      ),
    )
    .returning({ id: submissions.id });
  const anonymizedCorrections = await db
    .update(correctionRequests)
    .set({ contact_email: null })
    .where(
      and(
        isNotNull(correctionRequests.contact_email),
        or(
          and(
            or(
              eq(correctionRequests.status, 'accepted'),
              eq(correctionRequests.status, 'rejected'),
            ),
            isNotNull(correctionRequests.closed_at),
            lt(correctionRequests.closed_at, cutoff),
          ),
          and(eq(correctionRequests.status, 'open'), lt(correctionRequests.created_at, cutoff)),
        ),
      ),
    )
    .returning({ id: correctionRequests.id });

  return {
    releasedReservations,
    endedSponsorships: ended.length,
    anonymized: anonymizedSubmissions.length + anonymizedCorrections.length,
  };
}

/** Daily cron entry point. */
export async function runDailyMaintenance(env: Env): Promise<void> {
  const report = await maintain(database(env.DB), new Date());
  // eslint-disable-next-line no-console -- the daily report is meant for Workers Logs
  console.log(JSON.stringify({ event: 'maintenance', ...report }));
  if (report.endedSponsorships > 0)
    await dispatchRebuild(env, `${report.endedSponsorships} sponsorship(s) ended`);
}
