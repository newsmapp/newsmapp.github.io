import type { Category, Paywall } from '../../schemas/catalog.schema';
import type { AffiliateContext } from '../../schemas/monetization.schema';
import type { z } from 'zod';
import type { affiliateSchema, affiliatesFileSchema } from '../../schemas/monetization.schema';

export type Affiliate = z.infer<typeof affiliateSchema>;
export type AffiliatesConfig = z.infer<typeof affiliatesFileSchema>;

export const VPN_CONTEXTS: readonly AffiliateContext[] = ['vpn-travel', 'vpn-privacy'];

export type PageContext =
  | { kind: 'country'; paywalls: Paywall[] }
  | { kind: 'category'; category: Category }
  | { kind: 'outlet'; category: Category; paywall: Paywall };

/** Picks the offer for a page at build time (SPEC §3.6.2). Returns null when nothing active fits. */
export function selectAffiliate(config: AffiliatesConfig, page: PageContext): Affiliate | null {
  const contexts: AffiliateContext[] = [];
  const { by_category: byCategory, by_paywall: byPaywall } = config.rules;
  if (page.kind === 'outlet') {
    const fromPaywall = byPaywall[page.paywall];
    if (fromPaywall) contexts.push(fromPaywall);
    const fromCategory = byCategory[page.category];
    if (fromCategory) contexts.push(fromCategory);
  } else if (page.kind === 'category') {
    const fromCategory = byCategory[page.category];
    if (fromCategory) contexts.push(fromCategory);
  } else {
    const paid = page.paywalls.filter((p) => byPaywall[p]).length;
    // Mostly paid countries get legitimate paid-news access; others the travel offer.
    if (paid * 2 >= page.paywalls.length) {
      const context = page.paywalls.map((p) => byPaywall[p]).find(Boolean);
      if (context) contexts.push(context);
    }
    contexts.push('vpn-travel');
  }
  for (const context of contexts) {
    const offer = config.affiliates.find((a) => a.active && a.context === context);
    if (offer) return offer;
  }
  return null;
}

/** Destination URL for /go/aff-<id>/ with the configured public parameters. */
export function affiliateUrl(affiliate: Affiliate): string {
  const url = new URL(affiliate.url);
  for (const [key, value] of Object.entries(affiliate.params)) url.searchParams.set(key, value);
  return url.toString();
}

export const isVpnOffer = (affiliate: Affiliate): boolean =>
  VPN_CONTEXTS.includes(affiliate.context);
