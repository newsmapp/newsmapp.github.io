import catalogJson from '../generated/catalog.json';
import { CATEGORIES, type Category } from '../schemas/catalog.schema';
import { CONTINENTS, type Continent } from '../schemas/common';
import { localizePath, LANG_META, type Lang } from '../lib/i18n/lang';
import { LABELS } from '../lib/i18n/labels';
import { place, type Place } from '../lib/i18n/place';
import type { PublicCatalog, PublicCountry, PublicOutlet } from '../lib/catalog/public';
import {
  categoryPageEligible,
  continentHubs,
  outletsInCategory,
  profileIndexable,
} from '../lib/catalog/thresholds';

/** Build-time catalog: published countries and their verified outlets only. */
export const catalog = catalogJson as unknown as PublicCatalog;
export const countries = catalog.countries;
const byIso = new Map(countries.map((c) => [c.iso2, c]));

export const countryByIso = (iso2: string): PublicCountry | undefined => byIso.get(iso2);
export const countryName = (country: PublicCountry, lang: Lang): string =>
  country.name[lang] ?? country.name.en ?? country.iso2;
export const countryPlace = (country: PublicCountry, lang: Lang): Place =>
  place(countryName(country, lang), country.iso2, lang);

export const categoryLabel = (category: Category, lang: Lang): string =>
  LABELS[lang].category[category];

/** Countries in alphabetical order of their name in a language. */
export const sortedCountries = (lang: Lang): PublicCountry[] =>
  [...countries].sort((a, b) =>
    countryName(a, lang).localeCompare(countryName(b, lang), LANG_META[lang].intl),
  );

/** Published continents with a hub page, in display order. */
export const hubs = continentHubs(countries);
export const hubContinents = CONTINENTS.filter((c) => hubs.has(c));

export function countriesIn(continent: Continent): PublicCountry[] {
  return countries.filter((c) => c.continent === continent || c.also_in.includes(continent));
}

export const categoryPages = (country: PublicCountry, lang: Lang): Category[] =>
  CATEGORIES.filter((category) => categoryPageEligible(country, country.outlets, category, lang));

export const outletsFor = (country: PublicCountry, category: Category): PublicOutlet[] =>
  outletsInCategory(country.outlets, category);

export const isProfileIndexable = (outlet: PublicOutlet, lang: Lang): boolean =>
  profileIndexable(outlet, lang);

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

/** Site paths in a language; English at the root, other languages under /<lang>/. */
export const pathsFor = (lang: Lang) => {
  const at = (path: string) => localizePath(path, lang);
  return {
    home: at('/'),
    page: (path: string) => at(path),
    continent: (continent: Continent) => at(`/continent/${continent}/`),
    country: (country: PublicCountry) => at(`/${country.slug}/`),
    category: (country: PublicCountry, category: Category) =>
      at(`/${country.slug}/${category}/`),
    outlet: (country: PublicCountry, outlet: PublicOutlet) =>
      at(`/${country.slug}/outlet/${outlet.slug}/`),
    flag: (iso2: string) => `/flags/${iso2.toLowerCase()}.svg`,
  };
};
export type Paths = ReturnType<typeof pathsFor>;
