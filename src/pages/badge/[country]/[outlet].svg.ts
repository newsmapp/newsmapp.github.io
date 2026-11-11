import type { APIRoute, GetStaticPaths } from 'astro';
import { badgeSvg } from '../../../lib/badge';
import { badgeEntries, type BadgeEntry } from '../../../lib/catalog/public';
import { CATEGORY_LABELS } from '../../../schemas/catalog.schema';
import { catalog } from '../../../data/catalog';

/** H2 badge, written as a static SVG file for every ranked outlet at build time. */
export const getStaticPaths = (() =>
  badgeEntries(catalog).map((entry) => ({
    params: { country: entry.country_slug, outlet: entry.slug },
    props: { entry },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute<{ entry: BadgeEntry }> = ({ props: { entry } }) =>
  new Response(
    badgeSvg({
      rank: entry.position,
      category: CATEGORY_LABELS[entry.category],
      country: entry.country_name,
    }),
    { headers: { 'content-type': 'image/svg+xml; charset=utf-8' } },
  );
