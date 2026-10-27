import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { sponsorships, submissions } from '@/db/schema';
import { database, isUniqueViolation, type Database } from '@/server/db';
import {
  liveSponsorship,
  openSlots,
  releaseExpiredReservations,
  reserveSlot,
  type ReservationInput,
} from '@/server/sponsorships';
import { createTestD1 } from '../helpers/d1';

const NOW = new Date('2026-11-01T12:00:00.000Z');
const input: ReservationInput = {
  outlet_name: 'Example Daily',
  url: 'https://daily.example.com/',
  country_iso: 'PT',
  category: 'sports',
  contact_email: 'billing@example.com',
  plan: 'monthly',
  outlet_id: null,
};

let db: Database;
beforeEach(() => {
  db = database(createTestD1());
});

describe('reserveSlot', () => {
  it('claims positions 1..N and then reports the slot full', async () => {
    const positions = [];
    for (let i = 0; i < 3; i++) positions.push((await reserveSlot(db, input, 3, NOW))?.position);
    expect(positions).toEqual([1, 2, 3]);
    expect(await reserveSlot(db, input, 3, NOW)).toBeNull();
    expect(await openSlots(db, 'PT', 'sports', 3, NOW)).toBe(0);
    expect(await openSlots(db, 'PT', 'politics', 3, NOW)).toBe(3);
    const [submission] = await db.select().from(submissions).limit(1);
    expect(submission?.status).toBe('awaiting_payment');
  });

  it('frees expired reservations before claiming', async () => {
    await reserveSlot(db, input, 1, NOW);
    const later = new Date(NOW.getTime() + 31 * 60_000);
    expect(await openSlots(db, 'PT', 'sports', 1, later)).toBe(1);
    const second = await reserveSlot(db, input, 1, later);
    expect(second?.position).toBe(1);
    const statuses = (await db.select().from(sponsorships)).map((s) => s.status).sort();
    expect(statuses).toEqual(['ended', 'reserved']);
    const closed = await db
      .select()
      .from(submissions)
      .where(eq(submissions.status, 'awaiting_payment'));
    expect(closed.filter((s) => s.closed_at !== null)).toHaveLength(1);
  });

  it('the unique index rejects a second live claim on the same position', async () => {
    const first = await reserveSlot(db, input, 3, NOW);
    const error = await db
      .insert(sponsorships)
      .values({
        id: 'sp-dup',
        submission_id: first!.submissionId,
        outlet_name: 'Dup',
        outlet_url: 'https://dup.example.com/',
        country_iso: 'PT',
        category: 'sports',
        slot_position: first!.position,
        status: 'active',
      })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(isUniqueViolation(error)).toBe(true);
    expect(isUniqueViolation(new Error('other'))).toBe(false);
  });
});

describe('releaseExpiredReservations and liveSponsorship', () => {
  it('ends only reservations past their deadline and resolves only live listings', async () => {
    const r = await reserveSlot(db, input, 3, NOW);
    expect(await releaseExpiredReservations(db, NOW)).toBe(0);
    expect(await liveSponsorship(db, r!.sponsorshipId)).toBeNull();
    await db
      .update(sponsorships)
      .set({ status: 'active' })
      .where(eq(sponsorships.id, r!.sponsorshipId));
    expect((await liveSponsorship(db, r!.sponsorshipId))?.outlet_url).toBe(
      'https://daily.example.com/',
    );
    expect(await releaseExpiredReservations(db, new Date('2027-01-01T00:00:00.000Z'))).toBe(0);
  });
});

describe('concurrent checkout', () => {
  it('sells the last slot once when two buyers race for it', async () => {
    const results = await Promise.all([
      reserveSlot(db, input, 1, NOW),
      reserveSlot(db, input, 1, NOW),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await openSlots(db, 'PT', 'sports', 1, NOW)).toBe(0);
  });
});
