import type { APIRoute } from 'astro';
import { robotsTxt } from '../lib/seo/sitemap';

export const GET: APIRoute = ({ site }) =>
  new Response(robotsTxt((site ?? new URL('https://newsmapp.github.io')).toString()), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
