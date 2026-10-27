import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

export const database = (d1: D1Database) => drizzle(d1, { schema });
export type Database = ReturnType<typeof database>;

/** ISO timestamps in the same format D1 defaults use, so string comparison orders them. */
export const iso = (date: Date): string => date.toISOString();
export const addMinutes = (date: Date, minutes: number): Date =>
  new Date(date.getTime() + minutes * 60_000);
export const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * 86_400_000);

/** D1 and SQLite report constraint failures in the message only. */
export const isUniqueViolation = (error: unknown): boolean =>
  /UNIQUE constraint failed/i.test(String((error as { message?: unknown })?.message ?? error)) ||
  /UNIQUE constraint failed/i.test(
    String((error as { cause?: { message?: unknown } })?.cause?.message ?? ''),
  );
