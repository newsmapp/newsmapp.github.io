import { and, eq, inArray, isNotNull, lt, or, gt, sql } from 'drizzle-orm';
import { sponsorships, submissions } from '../db/schema';
import { addMinutes, iso, isUniqueViolation, type Database } from './db';
import { newId } from './crypto';

export const RESERVATION_MINUTES = 30;
export const LIVE = ['reserved', 'active', 'grace'] as const;

const slotOf = (country: string, category: string) =>
  and(eq(sponsorships.country_iso, country), eq(sponsorships.category, category));

/** A reservation that is still holding its slot. */
const holding = (now: Date) =>
  or(
    inArray(sponsorships.status, ['active', 'grace']),
    and(
      eq(sponsorships.status, 'reserved'),
      or(sql`${sponsorships.reserved_until} IS NULL`, gt(sponsorships.reserved_until, iso(now))),
    ),
  );

/** Releases reservations whose 30 minutes ran out without payment. */
export async function releaseExpiredReservations(
  db: Database,
  now: Date,
  where = sql`1 = 1`,
): Promise<number> {
  const released = await db
    .update(sponsorships)
    .set({ status: 'ended', ends_at: iso(now) })
    .where(
      and(
        eq(sponsorships.status, 'reserved'),
        isNotNull(sponsorships.reserved_until),
        lt(sponsorships.reserved_until, iso(now)),
        where,
      ),
    )
    .returning({ submission_id: sponsorships.submission_id });
  if (released.length > 0) {
    await db
      .update(submissions)
      .set({ closed_at: iso(now), updated_at: iso(now) })
      .where(
        and(
          inArray(
            submissions.id,
            released.map((r) => r.submission_id),
          ),
          eq(submissions.status, 'awaiting_payment'),
        ),
      );
  }
  return released.length;
}

export async function openSlots(
  db: Database,
  country: string,
  category: string,
  total: number,
  now: Date,
): Promise<number> {
  const [row] = await db
    .select({ taken: sql<number>`count(*)` })
    .from(sponsorships)
    .where(and(slotOf(country, category), holding(now)));
  return Math.max(0, total - Number(row?.taken ?? 0));
}

export interface ReservationInput {
  outlet_name: string;
  url: string;
  country_iso: string;
  category: string;
  contact_email: string;
  plan: 'monthly' | 'yearly';
  outlet_id: string | null;
}

export interface Reservation {
  submissionId: string;
  sponsorshipId: string;
  position: number;
  reservedUntil: string;
}

/**
 * Creates the submission and claims the first free slot for 30 minutes, atomically.
 * The partial unique index decides races: on a conflict the next position is tried.
 * Returns null when every slot is taken.
 */
export async function reserveSlot(
  db: Database,
  input: ReservationInput,
  total: number,
  now: Date,
): Promise<Reservation | null> {
  await releaseExpiredReservations(
    db,
    now,
    slotOf(input.country_iso, input.category) ?? sql`1 = 1`,
  );
  const reservedUntil = iso(addMinutes(now, RESERVATION_MINUTES));
  for (let attempt = 0; attempt < total; attempt++) {
    const taken = await db
      .select({ position: sponsorships.slot_position })
      .from(sponsorships)
      .where(and(slotOf(input.country_iso, input.category), inArray(sponsorships.status, LIVE)));
    const used = new Set(taken.map((t) => t.position));
    const position = Array.from({ length: total }, (_, i) => i + 1).find((p) => !used.has(p));
    if (position === undefined) return null;
    const submissionId = newId('sub');
    const sponsorshipId = newId('sp');
    try {
      await db.batch([
        db.insert(submissions).values({
          id: submissionId,
          outlet_name: input.outlet_name,
          url: input.url,
          country_iso: input.country_iso,
          category: input.category,
          contact_email: input.contact_email,
          plan: input.plan,
          status: 'awaiting_payment',
          created_at: iso(now),
          updated_at: iso(now),
        }),
        db.insert(sponsorships).values({
          id: sponsorshipId,
          submission_id: submissionId,
          outlet_id: input.outlet_id,
          outlet_name: input.outlet_name,
          outlet_url: input.url,
          country_iso: input.country_iso,
          category: input.category,
          slot_position: position,
          status: 'reserved',
          reserved_until: reservedUntil,
          created_at: iso(now),
        }),
      ]);
      return { submissionId, sponsorshipId, position, reservedUntil };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return null;
}

/** Live sponsored slot for /go/: only active or grace listings redirect. */
export async function liveSponsorship(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(sponsorships)
    .where(and(eq(sponsorships.id, id), inArray(sponsorships.status, ['active', 'grace'])))
    .limit(1);
  return row ?? null;
}
