import { DEFAULT_LANG, LANG_META, localizePath, type Lang } from '../i18n/lang';
import { absoluteUrl } from './meta';

export interface Alternate {
  hreflang: string;
  href: string;
}

/**
 * hreflang alternates for a page available in `langs`, given its English path. Emits nothing
 * while only one language is enabled.
 */
export function hreflangAlternates(
  path: string,
  langs: readonly Lang[],
  siteUrl: string,
): Alternate[] {
  if (langs.length <= 1) return [];
  const alternates = langs.map((lang) => ({
    hreflang: LANG_META[lang].tag,
    href: absoluteUrl(siteUrl, localizePath(path, lang)),
  }));
  return [
    ...alternates,
    { hreflang: 'x-default', href: absoluteUrl(siteUrl, localizePath(path, DEFAULT_LANG)) },
  ];
}
