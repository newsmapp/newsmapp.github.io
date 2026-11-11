import type { Country, Outlet } from '../../schemas/catalog.schema';
import type { Locale } from '../../schemas/common';
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
}

/** One embeddable badge, prerendered at /badge/<country_slug>/<slug>.svg. */
export interface BadgeEntry {
  id: string;
  country_slug: string;
  slug: string;
  country_name: string;
  /** Position in the primary category's column, as shown on the country page. */
  position: number;
  category: Outlet['primary_category'];
}

/**
 * Projects the validated catalog onto what the site may show: published countries and their
 * verified outlets only. Candidates and retired outlets never leave this function, unless `drafts`
 * asks for a local preview of every country and candidate (retired outlets stay out).
 */
export function toPublicCatalog(
  catalog: Catalog,
  locales: Locale[],
  hasRasterIcon: (id: string) => boolean,
  { drafts = false }: { drafts?: boolean } = {},
): PublicCatalog {
  const shown = (outlet: Outlet) => (drafts ? outlet.status !== 'retired' : isVerified(outlet));
  const countries = catalog.countries
    .filter((country) => drafts || country.published)
    .map((country) => ({
      ...country,
      outlets: (catalog.outlets.get(country.iso2) ?? [])
        .filter(shown)
        .map(({ health: _health, status: _status, ...outlet }): PublicOutlet => ({
          ...outlet,
          country: country.iso2,
          icon: `/icons/${outlet.id}.${hasRasterIcon(outlet.id) ? 'webp' : 'svg'}`,
        })),
    }))
    .sort((a, b) => (a.name.en ?? a.iso2).localeCompare(b.name.en ?? b.iso2, 'en'));
  return { locales, countries };
}

/** Badges for every listed outlet ranked in its primary category. */
export function badgeEntries(catalog: PublicCatalog): BadgeEntry[] {
  return catalog.countries.flatMap((country) =>
    country.outlets.flatMap((outlet): BadgeEntry[] => {
      const position =
        outletsInCategory(country.outlets, outlet.primary_category).findIndex(
          (o) => o.id === outlet.id,
        ) + 1;
      if (position < 1) return [];
      return [
        {
          id: outlet.id,
          country_slug: country.slug,
          slug: outlet.slug,
          country_name: country.name.en ?? country.iso2,
          position,
          category: outlet.primary_category,
        },
      ];
    }),
  );
}
