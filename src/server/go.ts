import type { RuntimeCatalog } from '../lib/catalog/public';
import { affiliateUrl, type AffiliatesConfig } from '../lib/monetization/affiliates';

/** /go/<id>/ ids: catalog outlet ids, aff-<affiliate id> or sp-<uuid> sponsorships. */
export const GO_ID = /^[a-z0-9][a-z0-9-]{0,119}$/;

export interface GoTarget {
  url: string;
  outletId: string;
  country: string;
  category: string;
  sponsored: boolean;
}

const withUtm = (url: string, medium: string, campaign: string): string => {
  const target = new URL(url);
  target.searchParams.set('utm_source', 'newsmapp');
  target.searchParams.set('utm_medium', medium);
  if (campaign) target.searchParams.set('utm_campaign', campaign);
  return target.toString();
};

/**
 * Resolves an id against the allowlists only. No destination ever comes from the request,
 * so /go/ cannot be used as an open redirect.
 */
export function resolveStatic(
  id: string,
  catalog: RuntimeCatalog,
  affiliates: AffiliatesConfig,
): GoTarget | null {
  if (!GO_ID.test(id)) return null;
  if (id.startsWith('aff-')) {
    const affiliate = affiliates.affiliates.find((a) => a.active && `aff-${a.id}` === id);
    if (!affiliate) return null;
    return {
      url: affiliateUrl(affiliate),
      outletId: id,
      country: '',
      category: affiliate.context,
      sponsored: true,
    };
  }
  const outlet = Object.hasOwn(catalog, id) ? catalog[id] : undefined;
  if (!outlet) return null;
  const category = outlet.categories[0] ?? '';
  return {
    url: withUtm(outlet.url, 'referral', ''),
    outletId: id,
    country: outlet.country,
    category,
    sponsored: false,
  };
}

export function sponsoredTarget(row: {
  id: string;
  outlet_url: string;
  country_iso: string;
  category: string;
}): GoTarget {
  return {
    url: withUtm(row.outlet_url, 'sponsored', `${row.country_iso.toLowerCase()}-${row.category}`),
    outletId: row.id,
    country: row.country_iso,
    category: row.category,
    sponsored: true,
  };
}

/** Redirect response: never cached, never indexed. */
export const redirect = (url: string): Response =>
  new Response(null, {
    status: 302,
    headers: {
      location: url,
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
      'referrer-policy': 'origin',
    },
  });
