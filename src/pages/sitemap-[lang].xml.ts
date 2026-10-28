import type { APIRoute, GetStaticPaths } from 'astro';
import { indexablePaths } from '../data/indexable';
import { siteLangs } from '../data/i18n';
import { urlset } from '../lib/seo/sitemap';
import type { Lang } from '../lib/i18n/lang';

/** One sitemap per language: sitemap-en.xml, sitemap-pt.xml. */
export const getStaticPaths = (() =>
  siteLangs.map((lang) => ({ params: { lang }, props: { lang } }))) satisfies GetStaticPaths;

export const GET: APIRoute<{ lang: Lang }> = ({ site, props }) => {
  const origin = (site ?? new URL('https://newsmap.example')).toString();
  const body = urlset(
    indexablePaths(props.lang).map((path) => ({ loc: new URL(path, origin).toString() })),
  );
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
