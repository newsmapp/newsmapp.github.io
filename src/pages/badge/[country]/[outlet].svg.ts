import type { APIRoute } from 'astro';
import { badgeSvg } from '../../../lib/badge';
import { CATEGORY_LABELS } from '../../../schemas/catalog.schema';
import { problem } from '../../../server/http';
import { catalog } from '../../../runtime/worker';

export const prerender = false;

const byPath = new Map(Object.values(catalog).map((o) => [`${o.country_slug}/${o.slug}`, o]));

/** H2 badge. Self-contained SVG, cached for a day at the edge. */
export const GET: APIRoute = ({ params }) => {
  const outlet = byPath.get(`${params.country ?? ''}/${params.outlet ?? ''}`);
  if (!outlet || outlet.badge.position < 1) return problem(404, 'Unknown outlet.');
  return new Response(
    badgeSvg({
      rank: outlet.badge.position,
      category: CATEGORY_LABELS[outlet.badge.category],
      country: outlet.country_name,
    }),
    {
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
        'cache-control': 'public, max-age=86400',
        'x-content-type-options': 'nosniff',
      },
    },
  );
};
