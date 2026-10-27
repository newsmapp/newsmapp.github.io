import type { Locale } from '../../schemas/common';
import { absoluteUrl } from './meta';

export interface Alternate {
  hreflang: string;
  href: string;
}

const DEFAULT_LOCALE: Locale = 'en';

/** Path of a page in a locale: the default locale lives at the root, others under /<locale>/. */
export function localizedPath(path: string, locale: Locale): string {
  return locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;
}

/**
 * hreflang alternates for a page available in `locales`. Emits nothing while only one locale
 * is enabled, so the v1.0 site carries no hreflang at all.
 */
export function hreflangAlternates(
  path: string,
  locales: readonly Locale[],
  siteUrl: string,
): Alternate[] {
  if (locales.length <= 1) return [];
  const alternates = locales.map((locale) => ({
    hreflang: locale,
    href: absoluteUrl(siteUrl, localizedPath(path, locale)),
  }));
  return [
    ...alternates,
    { hreflang: 'x-default', href: absoluteUrl(siteUrl, localizedPath(path, DEFAULT_LOCALE)) },
  ];
}
