import type { APIRoute } from 'astro';
import { indexablePaths } from '../data/indexable';
import { urlset } from '../lib/seo/sitemap';

export const GET: APIRoute = ({ site }) => {
  const origin = (site ?? new URL('https://newsmap.example')).toString();
  const body = urlset(indexablePaths().map((path) => ({ loc: new URL(path, origin).toString() })));
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
