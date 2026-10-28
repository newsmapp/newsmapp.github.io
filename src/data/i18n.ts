import { ENABLED_LOCALES } from 'astro:env/server';
import { DEFAULT_LANG, langFromPath, parseLangs, type Lang } from '../lib/i18n/lang';
import { LABELS } from '../lib/i18n/labels';
import { UI_TEXT } from '../lib/i18n/ui';
import { pathsFor } from './catalog';

/** Languages this build publishes, default first (ENABLED_LOCALES). */
export const siteLangs: Lang[] = parseLangs(ENABLED_LOCALES);

interface StaticPath<P, R> {
  params: P;
  props: R;
}

/**
 * Repeats a page's static paths for every site language: the `[...lang]` segment is empty for
 * English and "pt" for Portuguese, and each page receives its `lang` as a prop.
 */
export function forEachLang<P extends Record<string, string>, R extends object>(
  build: (lang: Lang) => StaticPath<P, R>[],
): StaticPath<P & { lang: string | undefined }, R & { lang: Lang }>[] {
  return siteLangs.flatMap((lang) =>
    build(lang).map(({ params, props }) => ({
      params: { ...params, lang: lang === DEFAULT_LANG ? undefined : lang },
      props: { ...props, lang },
    })),
  );
}

/** Language, copy, labels and paths for the page being rendered. */
export function i18n(url: URL) {
  const lang = langFromPath(url.pathname);
  return { lang, t: UI_TEXT[lang], l: LABELS[lang], paths: pathsFor(lang) };
}
