import { describe, expect, it } from 'vitest';
import { absoluteUrl, buildMeta, clamp, fitTitle } from '@/lib/seo/meta';
import { hreflangAlternates, localizedPath } from '@/lib/seo/hreflang';
import {
  breadcrumbList,
  faqPage,
  itemList,
  newsMediaOrganization,
  serializeJsonLd,
} from '@/lib/seo/jsonld';
import { robotsTxt, sitemapIndex, urlset } from '@/lib/seo/sitemap';

const SITE = 'https://newsmap.example';

describe('meta', () => {
  it('joins site and path with or without a trailing slash on the site', () => {
    expect(absoluteUrl(SITE, '/brazil/')).toBe('https://newsmap.example/brazil/');
    expect(absoluteUrl(`${SITE}/`, '/brazil/')).toBe('https://newsmap.example/brazil/');
  });

  it('clamps at a word boundary and drops trailing punctuation', () => {
    expect(clamp('short  text ')).toBe('short text');
    expect(clamp('one two, three four', 12)).toBe('one two…');
    expect(clamp('one two, three four', 12).length).toBeLessThanOrEqual(12);
  });

  it('suffixes the title once and maps noindex to robots', () => {
    const meta = buildMeta({ title: 'Brazil', description: 'd', path: '/brazil/', siteUrl: SITE });
    expect(meta.title).toBe('Brazil | NewsMapp');
    expect(meta.robots).toContain('index, follow');
    expect(meta.og['og:url']).toBe('https://newsmap.example/brazil/');
    const home = buildMeta({
      title: 'NewsMapp',
      description: 'd',
      path: '/',
      siteUrl: SITE,
      noindex: true,
    });
    expect(home.title).toBe('NewsMapp');
    expect(home.robots).toBe('noindex, follow');
    expect(
      buildMeta({ title: 'X | NewsMapp', description: 'd', path: '/', siteUrl: SITE }).title,
    ).toBe('X | NewsMapp');
  });
});

describe('fitTitle', () => {
  it('keeps the brand suffix when it fits, drops it otherwise, and falls back to shorter candidates', () => {
    expect(fitTitle(['Brazil'])).toBe('Brazil | NewsMapp');
    const long = 'Business, Finance & Markets in Portugal: 5 outlets compared';
    expect(fitTitle([long])).toBe(long);
    expect(fitTitle([`${long} and more`, 'Sports in Portugal'])).toBe(
      'Sports in Portugal | NewsMapp',
    );
    expect(fitTitle(['x'.repeat(80), 'y'.repeat(70)]).length).toBeLessThanOrEqual(60);
    expect(fitTitle([])).toBe('NewsMapp');
  });
});

describe('hreflang', () => {
  it('keeps the default locale at the root', () => {
    expect(localizedPath('/brazil/', 'en')).toBe('/brazil/');
    expect(localizedPath('/brazil/', 'pt')).toBe('/pt/brazil/');
  });

  it('emits nothing for a single locale and x-default otherwise', () => {
    expect(hreflangAlternates('/brazil/', ['en'], SITE)).toEqual([]);
    const alternates = hreflangAlternates('/brazil/', ['en', 'pt'], SITE);
    expect(alternates.map((a) => a.hreflang)).toEqual(['en', 'pt', 'x-default']);
    expect(alternates.at(-1)?.href).toBe('https://newsmap.example/brazil/');
  });
});

describe('jsonld', () => {
  it('escapes characters that could close the script element', () => {
    const out = serializeJsonLd({ name: '</script><b>&\u2028\u2029' });
    expect(out).not.toMatch(/[<>&\u2028\u2029]/);
    expect(JSON.parse(out)).toEqual({ name: '</script><b>&\u2028\u2029' });
  });

  it('numbers breadcrumbs and list items from 1 with absolute URLs', () => {
    const crumbs = breadcrumbList(SITE, [
      { label: 'Home', href: '/' },
      { label: 'Brazil', href: '/brazil/' },
    ]) as { itemListElement: { position: number; item: string }[] };
    expect(crumbs.itemListElement.map((i) => [i.position, i.item])).toEqual([
      [1, 'https://newsmap.example/'],
      [2, 'https://newsmap.example/brazil/'],
    ]);
    const list = itemList('Top', [{ name: 'A', url: 'https://a.example/' }]);
    expect(list).toMatchObject({ numberOfItems: 1, itemListElement: [{ position: 1, name: 'A' }] });
  });

  it('includes organization facts only when known', () => {
    const bare = newsMediaOrganization({
      name: 'A',
      url: 'https://a.example/',
      foundingYear: null,
      parentOrganization: null,
    });
    expect(bare).not.toHaveProperty('foundingDate');
    expect(bare).not.toHaveProperty('parentOrganization');
    const full = newsMediaOrganization({
      name: 'A',
      url: 'https://a.example/',
      foundingYear: 1921,
      parentOrganization: 'Group',
    });
    expect(full).toMatchObject({ foundingDate: '1921', parentOrganization: { name: 'Group' } });
    expect(faqPage([{ q: 'Q?', a: 'A.' }])).toMatchObject({
      mainEntity: [{ name: 'Q?', acceptedAnswer: { text: 'A.' } }],
    });
  });
});

describe('sitemap and robots', () => {
  it('escapes locations and omits empty lastmod', () => {
    const xml = urlset([
      { loc: 'https://newsmap.example/?a=1&b=2' },
      { loc: 'https://newsmap.example/x/', lastmod: '2026-01-01' },
    ]);
    expect(xml).toContain('<loc>https://newsmap.example/?a=1&amp;b=2</loc></url>');
    expect(xml).toContain('<lastmod>2026-01-01</lastmod>');
    expect(sitemapIndex(['https://newsmap.example/sitemap-en.xml'])).toContain('<sitemap><loc>');
  });

  it('blocks the redirect, API and admin paths and points to the index', () => {
    const robots = robotsTxt(SITE);
    for (const path of ['/go/', '/api/', '/admin/']) expect(robots).toContain(`Disallow: ${path}`);
    expect(robots).toContain('Sitemap: https://newsmap.example/sitemap-index.xml');
  });
});
