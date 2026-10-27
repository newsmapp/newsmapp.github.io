import { categoryPages, countries, hubContinents, isProfileIndexable, paths } from './catalog';

/** Static pages that are always indexable. */
const STATIC_PATHS = ['/', '/about/', '/methodology/', '/corrections/', '/disclosures/', '/privacy/', '/terms/', '/advertise/'];

/** Every indexable path, the single source for the sitemap (and checked by the SEO audit). */
export function indexablePaths(): string[] {
  return [
    ...STATIC_PATHS,
    ...hubContinents.map(paths.continent),
    ...countries.flatMap((country) => [
      paths.country(country),
      ...categoryPages(country).map((category) => paths.category(country, category)),
      ...country.outlets.filter(isProfileIndexable).map((outlet) => paths.outlet(country, outlet)),
    ]),
  ];
}
