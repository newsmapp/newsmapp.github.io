import { escapeXml } from '../xml';

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

export function urlset(entries: readonly SitemapEntry[]): string {
  const urls = entries
    .map(
      (e) =>
        `<url><loc>${escapeXml(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export function sitemapIndex(locs: readonly string[]): string {
  const items = locs.map((loc) => `<sitemap><loc>${escapeXml(loc)}</loc></sitemap>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
}

export function robotsTxt(siteUrl: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${new URL('/sitemap-index.xml', siteUrl).toString()}`,
    '',
  ].join('\n');
}
