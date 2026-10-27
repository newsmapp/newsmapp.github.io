import type { Country, Outlet } from '../../schemas/catalog.schema';
import type { Continent, Locale } from '../../schemas/common';
import type { Catalog } from './validate';
import { isVerified, outletsInCategory } from './thresholds';

export type PublicOutlet = Omit<Outlet, 'health' | 'status'> & {
  country: string;
  /** Path of the 40×40 icon under /icons/. */
  icon: string;
};

export type PublicCountry = Country & { outlets: PublicOutlet[] };

export interface PublicCatalog {
  locales: Locale[];
  countries: PublicCountry[];
  /** Every ISO country, for lookups (geo detection, names). Never generates pages. */
  geo: { iso2: string; name: string; continent: Continent; also_in: Continent[] }[];
}

/** Minimal data the Worker needs at runtime (redirects, badges, slot labels). */
export interface RuntimeOutlet {
  name: string;
  url: string;
  country: string;
  slug: string;
  categories: string[];
  country_slug: string;
  country_name: string;
  /** Position in the primary category's column, as shown on the country page (badge text). */
  badge: { position: number; category: Outlet['primary_category'] };
}

export type RuntimeCatalog = Record<string, RuntimeOutlet>;

/** "PT:example.com" for https://www.example.com/news/ in Portugal. */
export const outletHostKey = (country: string, url: string): string =>
  `${country}:${new URL(url).hostname.replace(/^www\./, '')}`;

/** Outlet ids by country and host, built once so checkout matches a sponsor's URL in O(1). */
export function outletHostIndex(catalog: RuntimeCatalog): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  // The first outlet wins when two in one country share a host, as the old lookup did.
  for (const [id, outlet] of Object.entries(catalog)) {
    const key = outletHostKey(outlet.country, outlet.url);
    if (!index.has(key)) index.set(key, id);
  }
  return index;
}

/**
 * Projects the validated catalog onto what the site may show: published countries and their
 * verified outlets only. Candidates and retired outlets never leave this function.
 */
export function toPublicCatalog(
  catalog: Catalog,
  locales: Locale[],
  hasRasterIcon: (id: string) => boolean,
): PublicCatalog {
  const countries = catalog.countries
    .filter((country) => country.published)
    .map((country) => ({
      ...country,
      outlets: (catalog.outlets.get(country.iso2) ?? [])
        .filter(isVerified)
        .map(({ health: _health, status: _status, ...outlet }): PublicOutlet => ({
          ...outlet,
          country: country.iso2,
          icon: `/icons/${outlet.id}.${hasRasterIcon(outlet.id) ? 'webp' : 'svg'}`,
        })),
    }))
    .sort((a, b) => (a.name.en ?? a.iso2).localeCompare(b.name.en ?? b.iso2, 'en'));
  return {
    locales,
    countries,
    geo: catalog.geo.map(({ iso2, name, continent, also_in }) => ({
      iso2,
      name,
      continent,
      also_in,
    })),
  };
}

export function toRuntimeCatalog(catalog: PublicCatalog): RuntimeCatalog {
  return Object.fromEntries(
    catalog.countries.flatMap((country) =>
      country.outlets.map((outlet): [string, RuntimeOutlet] => [
        outlet.id,
        {
          name: outlet.name,
          url: outlet.url,
          country: country.iso2,
          slug: outlet.slug,
          categories: outlet.categories,
          country_slug: country.slug,
          country_name: country.name.en ?? country.iso2,
          badge: {
            position:
              outletsInCategory(country.outlets, outlet.primary_category).findIndex(
                (o) => o.id === outlet.id,
              ) + 1,
            category: outlet.primary_category,
          },
        },
      ]),
    ),
  );
}
