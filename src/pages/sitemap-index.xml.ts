import type { APIRoute } from 'astro';
import { siteLangs } from '../data/i18n';
import { sitemapIndex } from '../lib/seo/sitemap';

export const GET: APIRoute = ({ site }) => {
  const origin = (site ?? new URL('https://newsmap.example')).toString();
  const body = sitemapIndex(
    siteLangs.map((lang) => new URL(`/sitemap-${lang}.xml`, origin).toString()),
  );
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
