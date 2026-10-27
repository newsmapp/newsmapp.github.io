import type { Category, Format, OwnershipType, Paywall } from '../schemas/catalog.schema';

/** Short, always-textual indicators (never color alone). */
export const PAYWALL_TAG: Record<Paywall, string> = {
  free: 'Free',
  metered: 'Metered',
  freemium: 'Freemium',
  hard: 'Paywall',
};

export const PAYWALL_DESCRIPTION: Record<Paywall, string> = {
  free: 'Free to read',
  metered: 'A few free articles, then a subscription',
  freemium: 'Some articles free, premium content paid',
  hard: 'Subscription required',
};

/** Ownership tags shown in rows only for the types readers need flagged. */
export const OWNERSHIP_TAG: Partial<Record<OwnershipType, string>> = {
  'state-controlled': 'STATE',
  'public-service': 'PUBLIC',
  nonprofit: 'NONPROFIT',
};

export const OWNERSHIP_LABEL: Record<OwnershipType, string> = {
  private: 'Private',
  'public-service': 'Public service',
  'state-controlled': 'State-controlled',
  nonprofit: 'Nonprofit',
  cooperative: 'Cooperative',
  unknown: 'Unknown',
};

export const FORMAT_TAG: Partial<Record<Format, string>> = {
  'broadcaster-tv': 'TV',
  'broadcaster-radio': 'RADIO',
};

export const FORMAT_LABEL: Record<Format, string> = {
  newspaper: 'Newspaper',
  'digital-native': 'Digital-native',
  'broadcaster-tv': 'TV broadcaster',
  'broadcaster-radio': 'Radio broadcaster',
  magazine: 'Magazine',
  agency: 'News agency',
};

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

/** One- or two-word names for the home page topic switcher, where the full labels do not fit. */
export const CATEGORY_SHORT: Record<Category, string> = {
  'general-news': 'National news',
  politics: 'Politics',
  sports: 'Sports',
  economy: 'Business',
  investigative: 'Investigative',
  'tech-science': 'Tech & science',
  broadcast: 'TV & radio',
  regional: 'Regional',
};

const numberFormat = new Intl.NumberFormat('en-US');
export const formatNumber = (value: number): string => numberFormat.format(value);

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
export const formatCompact = (value: number): string => compact.format(value);

export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/** Host without "www." for display ("folha.uol.com.br"). */
export const displayHost = (url: string): string => new URL(url).hostname.replace(/^www\./, '');
