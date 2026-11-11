import type { Lang } from '../lib/i18n/lang';
import { categoryPages, countries, hubContinents, isProfileIndexable, pathsFor } from './catalog';

/** Static pages that are always indexable, as English paths. */
const STATIC_PATHS = ['/', '/about/', '/methodology/', '/corrections/', '/disclosures/', '/privacy/', '/terms/'];

/** Every indexable path in a language, the single source for its sitemap (and checked by the SEO audit). */
export function indexablePaths(lang: Lang): string[] {
  const paths = pathsFor(lang);
  return [
    ...STATIC_PATHS.map(paths.page),
    ...hubContinents.map(paths.continent),
    ...countries.flatMap((country) => [
      paths.country(country),
      ...categoryPages(country, lang).map((category) => paths.category(country, category)),
      ...country.outlets
        .filter((outlet) => isProfileIndexable(outlet, lang))
        .map((outlet) => paths.outlet(country, outlet)),
    ]),
  ];
}
