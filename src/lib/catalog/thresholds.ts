import { CATEGORIES, type Category, type Country, type Outlet } from '../../schemas/catalog.schema';
import type { Continent, Locale } from '../../schemas/common';

/** Anti-thin-content thresholds (SPEC §3.5). */
export const THRESHOLDS = {
  countryMinOutlets: 15,
  countryMinCategories: 4,
  categoryPageMinOutlets: 5,
  columnMinOutlets: 3,
  continentHubMinCountries: 3,
} as const;

export const isVerified = (outlet: Outlet): boolean => outlet.status === 'verified';

/** Outlets of one category, ordered by editorial rank then name. */
export function outletsInCategory(outlets: readonly Outlet[], category: Category): Outlet[] {
  return outlets
    .filter((outlet) => outlet.categories.includes(category))
    .sort(
      (a, b) =>
        (a.ranks[category] ?? Number.MAX_SAFE_INTEGER) -
          (b.ranks[category] ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'en'),
    );
}

/** Categories that have at least one outlet, in the fixed grid order. */
export function coveredCategories(outlets: readonly Outlet[]): Category[] {
  return CATEGORIES.filter((category) => outlets.some((o) => o.categories.includes(category)));
}

export interface Readiness {
  ready: boolean;
  missing: string[];
}

/** Whether a country meets the publication threshold, and what is missing if not. */
export function countryReadiness(
  country: Country,
  outlets: readonly Outlet[],
  locales: readonly Locale[],
): Readiness {
  const verified = outlets.filter(isVerified);
  const categories = coveredCategories(verified);
  const missing: string[] = [];
  if (verified.length < THRESHOLDS.countryMinOutlets) {
    missing.push(`${THRESHOLDS.countryMinOutlets - verified.length} more verified outlets`);
  }
  if (categories.length < THRESHOLDS.countryMinCategories) {
    missing.push(
      `${THRESHOLDS.countryMinCategories - categories.length} more categories with verified outlets`,
    );
  }
  for (const locale of locales) {
    const context = country.seo_context[locale];
    if (!context) missing.push(`seo_context.${locale}`);
    else if (!context.reviewed) missing.push(`seo_context.${locale} review`);
  }
  return { ready: missing.length === 0, missing };
}

/** A country/category page exists only with enough verified outlets and a reviewed intro. */
export function categoryPageEligible(
  country: Country,
  outlets: readonly Outlet[],
  category: Category,
  locale: Locale,
): boolean {
  const context = country.seo_context[locale];
  const verified = outletsInCategory(outlets.filter(isVerified), category);
  return (
    verified.length >= THRESHOLDS.categoryPageMinOutlets &&
    context?.reviewed === true &&
    context.categories[category] !== undefined
  );
}

export interface CountryGrid {
  columns: { category: Category; outlets: Outlet[] }[];
  /** Outlets whose every category is too thin for its own column. */
  more: Outlet[];
}

/** Splits a country's outlets into category columns and the "More outlets" card. */
export function countryGrid(outlets: readonly Outlet[]): CountryGrid {
  const columns = CATEGORIES.map((category) => ({
    category,
    outlets: outletsInCategory(outlets, category),
  })).filter((column) => column.outlets.length >= THRESHOLDS.columnMinOutlets);
  const shown = new Set(columns.flatMap((column) => column.outlets.map((o) => o.id)));
  const more = outlets
    .filter((outlet) => !shown.has(outlet.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return { columns, more };
}

/** A profile is indexable only with a reviewed "about" text in the locale. */
export function profileIndexable(outlet: Outlet, locale: Locale): boolean {
  return isVerified(outlet) && outlet.about[locale]?.reviewed === true;
}

/** Continents with enough published countries for a hub page (counting also_in). */
export function continentHubs(
  countries: readonly Pick<Country, 'iso2' | 'continent' | 'also_in' | 'published'>[],
): Map<Continent, string[]> {
  const byContinent = new Map<Continent, string[]>();
  for (const country of countries.filter((c) => c.published)) {
    for (const continent of [country.continent, ...country.also_in]) {
      byContinent.set(continent, [...(byContinent.get(continent) ?? []), country.iso2]);
    }
  }
  for (const [continent, isos] of byContinent) {
    if (isos.length < THRESHOLDS.continentHubMinCountries) byContinent.delete(continent);
  }
  return byContinent;
}
