import type { Category } from '../schemas/catalog.schema';
import { LANGS, LANG_META, type Lang } from './i18n/lang';

export const CATEGORY_ICON: Record<Category, string> = {
  'general-news': 'newspaper',
  politics: 'landmark',
  sports: 'trophy',
  economy: 'chart-line',
  investigative: 'search-check',
  'tech-science': 'flask-conical',
  broadcast: 'radio',
  regional: 'map-pin',
};

const perLang = (options?: Intl.NumberFormatOptions) =>
  Object.fromEntries(
    LANGS.map((l) => [l, new Intl.NumberFormat(LANG_META[l].intl, options)]),
  ) as Record<Lang, Intl.NumberFormat>;
const numbers = perLang();
const compacts = perLang({ notation: 'compact', maximumFractionDigits: 1 });

export const formatNumber = (value: number, lang: Lang = 'en'): string =>
  numbers[lang].format(value);

export const formatCompact = (value: number, lang: Lang = 'en'): string =>
  compacts[lang].format(value);

export const plural = (count: number, one: string, many = `${one}s`, lang: Lang = 'en'): string =>
  `${formatNumber(count, lang)} ${count === 1 ? one : many}`;

/** Host without "www." for display ("folha.uol.com.br"). */
export const displayHost = (url: string): string => new URL(url).hostname.replace(/^www\./, '');
