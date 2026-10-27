import {
  CATEGORIES,
  RESERVED_SEGMENTS,
  countrySchema,
  outletsFileSchema,
  type Country,
  type Outlet,
} from '../../schemas/catalog.schema';
import type { Locale } from '../../schemas/common';
import { geoCountriesSchema, type GeoCountry } from '../../schemas/geo.schema';
import { countryReadiness } from './thresholds';

export interface RawFile {
  /** Path relative to the catalog root, used in messages. */
  file: string;
  data: unknown;
}

export interface CatalogInput {
  geo: unknown;
  countries: RawFile[];
  outlets: RawFile[];
  locales: readonly Locale[];
}

export interface Issue {
  severity: 'error' | 'warning';
  file: string;
  message: string;
}

export interface Catalog {
  geo: GeoCountry[];
  countries: Country[];
  /** Outlets keyed by country ISO2. */
  outlets: Map<string, Outlet[]>;
}

export const PITCH_LENGTH = { min: 60, max: 140 } as const;

const isoFromFile = (file: string): string =>
  (file.split('/').pop() ?? '').replace(/\.json$/, '').toUpperCase();

/** Validates the whole catalog: schemas, cross-references, uniqueness and thresholds. */
export function validateCatalog(input: CatalogInput): { catalog: Catalog; issues: Issue[] } {
  const issues: Issue[] = [];
  const error = (file: string, message: string) =>
    issues.push({ severity: 'error', file, message });
  const warn = (file: string, message: string) =>
    issues.push({ severity: 'warning', file, message });

  const geoResult = geoCountriesSchema.safeParse(input.geo);
  const geo = geoResult.success ? geoResult.data : [];
  if (!geoResult.success) error('geo/countries.json', geoResult.error.message);
  const geoByIso = new Map(geo.map((g) => [g.iso2, g]));
  const reserved = new Set<string>([...RESERVED_SEGMENTS, ...CATEGORIES]);

  const countries: Country[] = [];
  const countrySlugs = new Map<string, string>();
  for (const { file, data } of input.countries) {
    const parsed = countrySchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        error(file, `${issue.path.join('.') || '(root)'}: ${issue.message}`);
      }
      continue;
    }
    const country = parsed.data;
    if (country.iso2 !== isoFromFile(file)) error(file, `iso2 ${country.iso2} does not match file`);
    const geoEntry = geoByIso.get(country.iso2);
    if (!geoEntry) error(file, `${country.iso2} is not an ISO 3166-1 code`);
    else {
      if (geoEntry.iso3 !== country.iso3) error(file, `iso3 should be ${geoEntry.iso3}`);
      if (geoEntry.continent !== country.continent) {
        error(file, `continent should be ${geoEntry.continent} (data/geo)`);
      }
    }
    for (const neighbor of country.neighbors) {
      if (!geoByIso.has(neighbor)) error(file, `unknown neighbor ${neighbor}`);
    }
    if (reserved.has(country.slug)) error(file, `slug "${country.slug}" is reserved`);
    const clash = countrySlugs.get(country.slug);
    if (clash) error(file, `slug "${country.slug}" already used by ${clash}`);
    countrySlugs.set(country.slug, country.iso2);
    for (const locale of input.locales) {
      if (!country.name[locale]) error(file, `name.${locale} is required`);
      if (!country.seo_context[locale]) error(file, `seo_context.${locale} is required`);
    }
    countries.push(country);
  }
  const countryByIso = new Map(countries.map((c) => [c.iso2, c]));

  const outlets = new Map<string, Outlet[]>();
  const ids = new Map<string, string>();
  for (const { file, data } of input.outlets) {
    const iso = isoFromFile(file);
    if (!countryByIso.has(iso)) error(file, `no country file for ${iso}`);
    const parsed = outletsFileSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        error(file, `${issue.path.join('.') || '(root)'}: ${issue.message}`);
      }
      continue;
    }
    const slugs = new Set<string>();
    const ranksSeen = new Map<string, string>();
    for (const outlet of parsed.data) {
      const where = `${outlet.id}`;
      if (!outlet.id.startsWith(`${iso.toLowerCase()}-`)) {
        error(file, `${where}: id must start with "${iso.toLowerCase()}-"`);
      }
      const previous = ids.get(outlet.id);
      if (previous) error(file, `${where}: duplicate id (also in ${previous})`);
      ids.set(outlet.id, file);
      if (slugs.has(outlet.slug)) error(file, `${where}: duplicate slug "${outlet.slug}"`);
      slugs.add(outlet.slug);
      for (const locale of input.locales) {
        const pitch = outlet.pitch[locale];
        if (!pitch) error(file, `${where}: pitch.${locale} is required`);
        else if (pitch.length < PITCH_LENGTH.min || pitch.length > PITCH_LENGTH.max) {
          error(
            file,
            `${where}: pitch.${locale} has ${pitch.length} chars (${PITCH_LENGTH.min}–${PITCH_LENGTH.max})`,
          );
        }
      }
      if (outlet.status !== 'retired') {
        for (const [category, rank] of Object.entries(outlet.ranks)) {
          const key = `${category}#${rank}`;
          const holder = ranksSeen.get(key);
          if (holder)
            error(file, `${where}: rank ${rank} in ${category} already held by ${holder}`);
          ranksSeen.set(key, outlet.id);
        }
      }
      if (outlet.status === 'verified' && outlet.health && outlet.health.http_status !== 200) {
        warn(
          file,
          `${where}: last health check returned ${outlet.health.http_status ?? 'no response'}`,
        );
      }
    }
    outlets.set(iso, parsed.data);
  }

  for (const country of countries) {
    if (!country.published) continue;
    const readiness = countryReadiness(country, outlets.get(country.iso2) ?? [], input.locales);
    if (!readiness.ready) {
      error(
        `countries/${country.iso2.toLowerCase()}.json`,
        `published but below threshold: ${readiness.missing.join(', ')}`,
      );
    }
  }

  return { catalog: { geo, countries, outlets }, issues };
}
