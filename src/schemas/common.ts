import { z } from 'zod';

export const LOCALES = ['en', 'pt', 'es', 'fr', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const CONTINENTS = [
  'africa',
  'antarctica',
  'asia',
  'europe',
  'north-america',
  'oceania',
  'south-america',
] as const;
export type Continent = (typeof CONTINENTS)[number];

// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Any human-readable string: trimmed, non-empty, no control characters. */
export const text = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !CONTROL_CHARS.test(value), 'contains control characters');

export const iso2 = z.string().regex(/^[A-Z]{2}$/, 'must be an ISO 3166-1 alpha-2 code');
export const iso3 = z.string().regex(/^[A-Z]{3}$/, 'must be an ISO 3166-1 alpha-3 code');
export const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase and hyphenated');
export const isoDate = z.iso.date();

export const httpsUrl = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.includes('.') && !value.includes(' ');
  } catch {
    return false;
  }
}, 'must be an absolute https:// URL');

/** A value per locale; which locales are required is decided by ENABLED_LOCALES at validation. */
export const localized = <T extends z.ZodType>(schema: T) =>
  z.partialRecord(z.enum(LOCALES), schema);
