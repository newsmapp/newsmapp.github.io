import catalogJson from '../generated/catalog.json';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '../schemas/catalog.schema';
import { CONTINENTS, type Continent, type Locale } from '../schemas/common';
import type { PublicCatalog, PublicCountry, PublicOutlet } from '../lib/catalog/public';
import {
  categoryPageEligible,
  continentHubs,
  outletsInCategory,
  profileIndexable,
} from '../lib/catalog/thresholds';

/** Build-time catalog: published countries and their verified outlets only. */
export const catalog = catalogJson as unknown as PublicCatalog;
export const LOCALE: Locale = 'en';

export const CONTINENT_LABELS: Record<Continent, string> = {
  africa: 'Africa',
  antarctica: 'Antarctica',
  asia: 'Asia',
  europe: 'Europe',
  'north-america': 'North America',
  oceania: 'Oceania',
  'south-america': 'South America',
};

export const countries = catalog.countries;
const byIso = new Map(countries.map((c) => [c.iso2, c]));
const bySlug = new Map(countries.map((c) => [c.slug, c]));
const geoByIso = new Map(catalog.geo.map((g) => [g.iso2, g]));

export const countryByIso = (iso2: string): PublicCountry | undefined => byIso.get(iso2);
export const countryBySlug = (slug: string): PublicCountry | undefined => bySlug.get(slug);
export const countryName = (country: PublicCountry): string => country.name[LOCALE] ?? country.iso2;
export const geoName = (iso2: string): string => geoByIso.get(iso2)?.name ?? iso2;

export const categoryLabel = (category: Category): string => CATEGORY_LABELS[category];

/** Published continents with a hub page, in display order. */
export const hubs = continentHubs(countries);
export const hubContinents = CONTINENTS.filter((c) => hubs.has(c));

export function countriesIn(continent: Continent): PublicCountry[] {
  return countries.filter((c) => c.continent === continent || c.also_in.includes(continent));
}

export const categoryPages = (country: PublicCountry): Category[] =>
  CATEGORIES.filter((category) => categoryPageEligible(country, country.outlets, category, LOCALE));

export const outletsFor = (country: PublicCountry, category: Category): PublicOutlet[] =>
  outletsInCategory(country.outlets, category);

export const isProfileIndexable = (outlet: PublicOutlet): boolean =>
  profileIndexable(outlet, LOCALE);

/** Published neighbors, then same-continent countries, for internal linking. */
export function relatedCountries(country: PublicCountry, limit = 6): PublicCountry[] {
  const neighbors = country.neighbors.flatMap((iso) => byIso.get(iso) ?? []);
  const sameContinent = countriesIn(country.continent).filter(
    (c) => c.iso2 !== country.iso2 && !neighbors.includes(c),
  );
  return [...neighbors, ...sameContinent].slice(0, limit);
}

/** Similar outlets: same country and primary category, same ownership type first. */
export function similarOutlets(country: PublicCountry, outlet: PublicOutlet, limit = 5): PublicOutlet[] {
  return country.outlets
    .filter((o) => o.id !== outlet.id && o.categories.includes(outlet.primary_category))
    .sort(
      (a, b) =>
        Number(b.ownership_type === outlet.ownership_type) -
          Number(a.ownership_type === outlet.ownership_type) ||
        (a.ranks[outlet.primary_category] ?? 99) - (b.ranks[outlet.primary_category] ?? 99),
    )
    .slice(0, limit);
}

export const paths = {
  home: '/',
  continent: (continent: Continent) => `/continent/${continent}/`,
  country: (country: PublicCountry) => `/${country.slug}/`,
  category: (country: PublicCountry, category: Category) => `/${country.slug}/${category}/`,
  outlet: (country: PublicCountry, outlet: PublicOutlet) => `/${country.slug}/outlet/${outlet.slug}/`,
  go: (id: string) => `/go/${id}/`,
  flag: (iso2: string) => `/flags/${iso2.toLowerCase()}.svg`,
};
