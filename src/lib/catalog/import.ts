import {
  CATEGORIES,
  FORMATS,
  OWNERSHIP_TYPES,
  PAYWALLS,
  type Category,
  type Outlet,
} from '../../schemas/catalog.schema';
import { slugify } from './slugify';

/** Columns accepted by `catalog:import` / `catalog:draft`. Only name, url and categories are required. */
export const IMPORT_COLUMNS = [
  'country',
  'name',
  'slug',
  'url',
  'rss_url',
  'language',
  'categories',
  'region',
  'founded_year',
  'paywall',
  'ownership_type',
  'owner',
  'ownership_source',
  'format',
  'editor_pick',
  'pitch',
] as const;

const oneOf = <T extends string>(values: readonly T[], value: string, column: string): T => {
  if ((values as readonly string[]).includes(value)) return value as T;
  throw new Error(`${column}: "${value}" is not one of ${values.join(', ')}`);
};

const orNull = (value: string | undefined): string | null =>
  value === undefined || value === '' ? null : value;

/**
 * Turns import rows into `candidate` outlets for one country. Existing outlets are never
 * modified: rows whose id already exists are skipped. Ranks continue after the current ones.
 */
export function importCandidates(
  iso2: string,
  existing: readonly Outlet[],
  rows: readonly Record<string, string>[],
  defaultLanguage: string,
): { added: Outlet[]; skipped: string[] } {
  const prefix = iso2.toLowerCase();
  const ids = new Set(existing.map((outlet) => outlet.id));
  const nextRank = new Map<Category, number>();
  for (const category of CATEGORIES) {
    const ranks = existing.filter((o) => o.status !== 'retired').map((o) => o.ranks[category] ?? 0);
    nextRank.set(category, Math.max(0, ...ranks) + 1);
  }

  const added: Outlet[] = [];
  const skipped: string[] = [];
  rows.forEach((row, index) => {
    const line = `row ${index + 2}`;
    try {
      if (row.country && row.country.toUpperCase() !== iso2) return;
      const name = row.name ?? '';
      const slug = row.slug || slugify(name);
      if (!name || !slug) throw new Error('name is required');
      const id = `${prefix}-${slug}`;
      if (ids.has(id)) {
        skipped.push(id);
        return;
      }
      const categories = (row.categories ?? '')
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => oneOf(CATEGORIES, c, 'categories'));
      const primary = categories[0];
      if (!primary) throw new Error('categories is required');
      const ranks: Partial<Record<Category, number>> = {};
      for (const category of categories) {
        const rank = nextRank.get(category) ?? 1;
        ranks[category] = rank;
        nextRank.set(category, rank + 1);
      }
      const ownership = oneOf(OWNERSHIP_TYPES, row.ownership_type || 'unknown', 'ownership_type');
      const sources = row.ownership_source
        ? [{ field: 'ownership_type', url: row.ownership_source }]
        : [];
      const year = row.founded_year ? Number(row.founded_year) : null;
      added.push({
        id,
        slug,
        name,
        url: row.url ?? '',
        rss_url: orNull(row.rss_url),
        language: row.language || defaultLanguage,
        categories,
        primary_category: primary,
        ranks,
        region: orNull(row.region),
        founded_year: Number.isInteger(year) ? year : null,
        paywall: oneOf(PAYWALLS, row.paywall || 'free', 'paywall'),
        ownership_type: ownership,
        owner: orNull(row.owner),
        political_lean: { value: 'unrated', source_url: null },
        format: oneOf(FORMATS, row.format || 'newspaper', 'format'),
        editor_pick: /^(y|yes|true|1)$/i.test(row.editor_pick ?? ''),
        pitch: row.pitch ? { en: row.pitch } : {},
        about: {},
        sources,
        status: 'candidate',
        verified_at: null,
        health: null,
      });
      ids.add(id);
    } catch (cause) {
      throw new Error(`${line}: ${(cause as Error).message}`, { cause });
    }
  });
  return { added, skipped };
}
