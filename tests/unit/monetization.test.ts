import { describe, expect, it } from 'vitest';
import affiliatesJson from '../../data/monetization/affiliates.json';
import pricingJson from '../../data/monetization/pricing.json';
import { affiliatesFileSchema, pricingFileSchema } from '@/schemas/monetization.schema';
import {
  affiliateUrl,
  isVpnOffer,
  selectAffiliate,
  type AffiliatesConfig,
} from '@/lib/monetization/affiliates';
import { shouldHideVpn } from '@/lib/monetization/geo';
import {
  formatUsd,
  priceFor,
  priceRows,
  tierFor,
  yearlySavingMonths,
  type Pricing,
} from '@/lib/monetization/pricing';

const shipped = affiliatesFileSchema.parse(affiliatesJson);
// The shipped config keeps every offer off until the owner adds real IDs.
const config: AffiliatesConfig = {
  ...shipped,
  affiliates: shipped.affiliates.map((a) => ({ ...a, active: true })),
};

describe('selectAffiliate', () => {
  it('returns nothing while every offer is inactive', () => {
    expect(selectAffiliate(shipped, { kind: 'category', category: 'sports' })).toBeNull();
  });

  it('prefers the paywall offer on an outlet page, then the category one', () => {
    expect(
      selectAffiliate(config, { kind: 'outlet', category: 'sports', paywall: 'hard' })?.context,
    ).toBe('paid-news');
    expect(
      selectAffiliate(config, { kind: 'outlet', category: 'sports', paywall: 'free' })?.context,
    ).toBe('vpn-travel');
    expect(
      selectAffiliate(config, { kind: 'outlet', category: 'general-news', paywall: 'free' }),
    ).toBeNull();
  });

  it('maps a category page through by_category', () => {
    expect(selectAffiliate(config, { kind: 'category', category: 'economy' })?.context).toBe(
      'finance',
    );
    expect(selectAffiliate(config, { kind: 'category', category: 'general-news' })).toBeNull();
  });

  it('offers paid news on mostly paid countries and travel otherwise', () => {
    expect(
      selectAffiliate(config, { kind: 'country', paywalls: ['hard', 'metered', 'free'] })?.context,
    ).toBe('paid-news');
    expect(
      selectAffiliate(config, { kind: 'country', paywalls: ['free', 'free', 'hard'] })?.context,
    ).toBe('vpn-travel');
  });

  it('adds the configured parameters to the destination', () => {
    const offer = config.affiliates[0]!;
    const url = new URL(affiliateUrl(offer));
    expect(url.searchParams.get('utm_source')).toBe('newsmap');
    expect(isVpnOffer(offer)).toBe(offer.context.startsWith('vpn'));
  });
});

describe('shouldHideVpn', () => {
  it('hides for restricted visitors and on the visitor’s own country page', () => {
    expect(shouldHideVpn('CN', 'BR', ['CN'])).toBe(true);
    expect(shouldHideVpn('BR', 'BR', [])).toBe(true);
    expect(shouldHideVpn('PT', 'BR', ['CN'])).toBe(false);
    expect(shouldHideVpn(null, 'BR', ['CN'])).toBe(false);
  });
});

describe('pricing', () => {
  const pricing = pricingFileSchema.parse(pricingJson);
  const custom: Pricing = {
    ...pricing,
    default_tier: 2,
    tiers: [
      { ...pricing.tiers[0]!, tier: 1, countries: ['US'], monthly: 39, yearly: 349 },
      { ...pricing.tiers[0]!, tier: 2, countries: ['BR'], monthly: 29, yearly: 249 },
      { ...pricing.tiers[0]!, tier: 3, countries: ['NG'], monthly: 19, yearly: 169 },
    ],
  };

  it('falls back to the default tier for unlisted countries', () => {
    expect(tierFor(custom, 'US').tier).toBe(1);
    expect(tierFor(custom, 'ZZ').tier).toBe(2);
    expect(priceFor(custom, 'NG', 'yearly')).toBe(169);
    expect(() => tierFor({ ...custom, default_tier: 9 }, 'ZZ')).toThrow(/No pricing tier/);
  });

  it('labels the default tier as covering all other countries and hides empty tiers', () => {
    const names: Record<string, string> = { US: 'United States' };
    const rows = priceRows(custom, (iso) => names[iso]);
    expect(rows.map((r) => [r.tier.tier, r.label])).toEqual([
      [1, 'United States'],
      [2, 'All other countries'],
    ]);
    names.BR = 'Brazil';
    expect(priceRows(custom, (iso) => names[iso])[1]?.label).toBe('Brazil and all other countries');
  });

  it('computes yearly savings and formats whole dollars', () => {
    expect(yearlySavingMonths(custom.tiers[0]!)).toBe(3);
    expect(formatUsd(1234)).toBe('$1,234');
  });
});
