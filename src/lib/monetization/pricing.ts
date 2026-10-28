import type { z } from 'zod';
import type { Plan, pricingFileSchema } from '../../schemas/monetization.schema';
import { LANG_META, type Lang } from '../i18n/lang';

export type Pricing = z.infer<typeof pricingFileSchema>;
export type Tier = Pricing['tiers'][number];

/** The tier for a country, falling back to the default tier. */
export function tierFor(pricing: Pricing, iso2: string): Tier {
  const tier =
    pricing.tiers.find((t) => t.countries.includes(iso2)) ??
    pricing.tiers.find((t) => t.tier === pricing.default_tier);
  if (!tier) throw new Error(`No pricing tier for ${iso2} and no default tier`);
  return tier;
}

export const priceFor = (pricing: Pricing, iso2: string, plan: Plan): number =>
  tierFor(pricing, iso2)[plan];

/** Months of the monthly price saved by paying yearly, rounded down. */
export const yearlySavingMonths = (tier: Tier): number =>
  Math.floor((tier.monthly * 12 - tier.yearly) / tier.monthly);

export const formatUsd = (value: number, lang: Lang = 'en'): string =>
  new Intl.NumberFormat(LANG_META[lang].intl, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

export interface PriceRow {
  tier: Tier;
  label: string;
}

/**
 * Rows for the public price table: each tier with the published countries it covers.
 * The default tier also covers every country not listed, so it says so; tiers with no
 * published country are left out.
 */
/** How the default tier's row is worded. */
export interface OthersWording {
  all: string;
  and: (listed: string) => string;
}

const OTHERS_EN: OthersWording = {
  all: 'All other countries',
  and: (listed) => `${listed} and all other countries`,
};

export function priceRows(
  pricing: Pricing,
  nameOf: (iso2: string) => string | undefined,
  others: OthersWording = OTHERS_EN,
): PriceRow[] {
  return pricing.tiers.flatMap((tier) => {
    const names = tier.countries.flatMap((iso) => nameOf(iso) ?? []);
    const isDefault = tier.tier === pricing.default_tier;
    if (names.length === 0 && !isDefault) return [];
    const listed = names.join(', ');
    const label = isDefault ? (listed ? others.and(listed) : others.all) : listed;
    return [{ tier, label }];
  });
}
