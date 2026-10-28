import type { Locale } from '../../schemas/common';

/** Languages the site is built in. English lives at the root, the others under /<lang>/ (ADR 0003). */
export const LANGS = ['en', 'pt'] as const satisfies readonly Locale[];
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'en';

interface LangMeta {
  /** `<html lang>` and hreflang value. */
  tag: string;
  /** Locale for Intl formatters and sorting. */
  intl: string;
  /** og:locale. */
  og: string;
  /** Name of the language in itself, for the language switcher. */
  name: string;
}

export const LANG_META: Record<Lang, LangMeta> = {
  en: { tag: 'en', intl: 'en-US', og: 'en_US', name: 'English' },
  pt: { tag: 'pt-BR', intl: 'pt-BR', og: 'pt_BR', name: 'Português' },
};

export const isLang = (value: string): value is Lang =>
  (LANGS as readonly string[]).includes(value);

/** Language of a site path: the first segment when it names a language, else the default. */
export function langFromPath(pathname: string): Lang {
  const first = pathname.split('/')[1] ?? '';
  return isLang(first) && first !== DEFAULT_LANG ? first : DEFAULT_LANG;
}

/** The same page without its language prefix ("/pt/brazil/" → "/brazil/"). */
export function stripLang(pathname: string): string {
  const lang = langFromPath(pathname);
  return lang === DEFAULT_LANG ? pathname : pathname.slice(lang.length + 1) || '/';
}

/** A root-relative path in a language ("/brazil/" → "/pt/brazil/"). Fragments and queries are kept. */
export function localizePath(path: string, lang: Lang): string {
  return lang === DEFAULT_LANG ? path : `/${lang}${path}`;
}

/** Parses ENABLED_LOCALES ("en,pt") into the site languages, default first; unknown values are dropped. */
export function parseLangs(value: string): Lang[] {
  const listed = value
    .split(',')
    .map((l) => l.trim())
    .filter(isLang);
  return [DEFAULT_LANG, ...LANGS.filter((l) => l !== DEFAULT_LANG && listed.includes(l))];
}
