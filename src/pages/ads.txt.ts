import type { APIRoute } from 'astro';
import ads from '../../data/monetization/ads.json';

/** Authorized sellers. Empty until an ad network approves the site (R3). */
interface Seller {
  domain: string;
  publisher_id: string;
  relationship: 'DIRECT' | 'RESELLER';
  certification_id?: string;
}

export const GET: APIRoute = () => {
  const lines = (ads.sellers as Seller[]).map((s) =>
    [s.domain, s.publisher_id, s.relationship, s.certification_id].filter(Boolean).join(', '),
  );
  const body = lines.length > 0 ? `${lines.join('\n')}\n` : '# No authorized sellers yet.\n';
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
