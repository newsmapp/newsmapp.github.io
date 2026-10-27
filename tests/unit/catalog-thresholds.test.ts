import { describe, expect, it } from 'vitest';
import {
  THRESHOLDS,
  categoryPageEligible,
  continentHubs,
  countryGrid,
  countryReadiness,
  coveredCategories,
  outletsInCategory,
  profileIndexable,
} from '@/lib/catalog/thresholds';
import { validateCatalog } from '@/lib/catalog/validate';
import { FIXTURES, loadInput } from '../helpers/catalog';

const { catalog } = validateCatalog(loadInput(FIXTURES));
const pt = catalog.countries.find((c) => c.iso2 === 'PT')!;
const ptOutlets = catalog.outlets.get('PT')!;
const verified = ptOutlets.filter((o) => o.status === 'verified');

describe('catalog thresholds', () => {
  it('orders a category by rank, then name', () => {
    const general = outletsInCategory(verified, 'general-news');
    expect(general.map((o) => o.ranks['general-news'])).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('lists covered categories in grid order', () => {
    expect(coveredCategories(verified)).toEqual([
      'general-news',
      'politics',
      'sports',
      'economy',
      'tech-science',
      'broadcast',
    ]);
  });

  it('marks a complete country as ready and explains what an incomplete one lacks', () => {
    expect(countryReadiness(pt, ptOutlets, ['en'])).toEqual({ ready: true, missing: [] });
    const italy = catalog.countries.find((c) => c.iso2 === 'IT')!;
    const readiness = countryReadiness(italy, catalog.outlets.get('IT')!, ['en', 'pt']);
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toEqual([
      `${THRESHOLDS.countryMinOutlets} more verified outlets`,
      `${THRESHOLDS.countryMinCategories} more categories with verified outlets`,
      'seo_context.en review',
      'seo_context.pt',
    ]);
  });

  it('builds category pages only with enough verified outlets and a reviewed intro', () => {
    expect(categoryPageEligible(pt, ptOutlets, 'general-news', 'en')).toBe(true);
    expect(categoryPageEligible(pt, ptOutlets, 'economy', 'en')).toBe(true);
    // Enough outlets? No (4). Intro? No.
    expect(categoryPageEligible(pt, ptOutlets, 'sports', 'en')).toBe(false);
    expect(categoryPageEligible(pt, ptOutlets, 'general-news', 'pt')).toBe(false);
  });

  it('moves thin categories into the "More outlets" card', () => {
    const grid = countryGrid(verified);
    expect(grid.columns.map((c) => c.category)).toEqual([
      'general-news',
      'politics',
      'sports',
      'economy',
    ]);
    // Tech outlets (2) and the broadcast-only column (2) fall below the column minimum.
    expect(grid.more.map((o) => o.slug).sort()).toEqual(['circuit-review', 'lab-notes']);
  });

  it('indexes profiles only with a reviewed about text', () => {
    expect(profileIndexable(verified[0]!, 'en')).toBe(true);
    expect(profileIndexable(verified[10]!, 'en')).toBe(false);
    const candidate = ptOutlets.find((o) => o.status === 'candidate')!;
    expect(profileIndexable(candidate, 'en')).toBe(false);
  });

  it('builds continent hubs from published countries, counting also_in', () => {
    const hubs = continentHubs(catalog.countries);
    expect([...hubs.keys()]).toEqual(['europe']);
    expect(hubs.get('europe')?.sort()).toEqual(['ES', 'FR', 'PT']);
    const withTurkey = continentHubs([
      { iso2: 'TR', continent: 'asia', also_in: ['europe'], published: true },
      { iso2: 'JP', continent: 'asia', also_in: [], published: true },
      { iso2: 'KR', continent: 'asia', also_in: [], published: true },
    ]);
    expect(withTurkey.get('asia')).toEqual(['TR', 'JP', 'KR']);
    expect(withTurkey.has('europe')).toBe(false);
  });
});
