import { describe, expect, it } from 'vitest';
import { audit, readPage, type AuditInput } from './audit';

const SITE = 'https://newsmap.example';
const page = (
  path: string,
  extra = '',
  opts: { title?: string; description?: string; robots?: string } = {},
) => ({
  path,
  html: `<html><head><title>${opts.title ?? 'Newspapers in Portugal: 18 outlets compared'}</title>
<meta name="description" content="${opts.description ?? 'Compare 18 newspapers, TV and radio news and news sites in Portugal, ranked by category, with paywall and ownership.'}">
${opts.robots ? `<meta name="robots" content="${opts.robots}">` : ''}
<link rel="canonical" href="${SITE}${path}"></head><body>${extra}</body></html>`,
});

const base = (pages: AuditInput['pages'], overrides: Partial<AuditInput> = {}): AuditInput => ({
  siteUrl: SITE,
  pages,
  sitemapLocs: [],
  exists: (path) => pages.some((p) => p.path === path),
  locales: 1,
  hiddenOutletIds: new Set(),
  hiddenPaths: new Set(),
  ...overrides,
});

const rules = (input: AuditInput) => audit(input).map((f) => f.rule);

describe('readPage', () => {
  it('reads head tags with either quote style and decodes entities', () => {
    const parsed = readPage(
      `<head><title>A &amp; B</title><meta content='x' name='description'><meta name="robots" content="noindex, follow"></head><a href='/a/' rel="sponsored noopener">a</a>`,
    );
    expect(parsed).toMatchObject({ title: 'A & B', description: 'x', noindex: true });
    expect(parsed.anchors[0]).toMatchObject({ href: '/a/', rel: 'sponsored noopener' });
  });
});

describe('audit', () => {
  it('passes a clean page', () => {
    expect(audit(base([page('/portugal/')]))).toEqual([]);
  });

  it('flags title and description length, duplicates and empty titles', () => {
    const pages = [
      page('/a/', '', { title: 'Short' }),
      page('/b/', '', { description: 'Too short.' }),
      page('/c/'),
      page('/d/', '', { title: '' }),
    ];
    const found = rules(base(pages));
    expect(found).toEqual(
      expect.arrayContaining(['title-length', 'description-length', 'duplicate-title', 'title']),
    );
  });

  it('skips length rules on noindex pages but still requires a canonical', () => {
    const noindex = page('/thanks/', '', { title: 'Hi', robots: 'noindex, follow' });
    expect(rules(base([noindex]))).toEqual([]);
    expect(
      rules(
        base([
          {
            path: '/x/',
            html: '<head><title>Newspapers in Portugal: 18 outlets compared</title></head>',
          },
        ]),
      ),
    ).toContain('canonical');
  });

  it('checks canonicals, hreflang and JSON-LD', () => {
    const wrong = { path: '/a/', html: page('/b/').html };
    expect(rules(base([wrong]))).toContain('canonical');
    const hreflang = page('/a/', '').html.replace(
      '</head>',
      `<link rel="alternate" hreflang="pt" href="${SITE}/pt/a/"></head>`,
    );
    expect(rules(base([{ path: '/a/', html: hreflang }]))).toContain('hreflang');
    const oneWay = base([{ path: '/a/', html: hreflang }, page('/pt/a/')], { locales: 2 });
    expect(rules(oneWay)).toContain('hreflang');
    const jsonld = (body: string) =>
      page('/a/', `<script type="application/ld+json">${body}</script>`);
    expect(rules(base([jsonld('{"@type":"BreadcrumbList"}')]))).toEqual([]);
    expect(rules(base([jsonld('{"@type":"Product"}')]))).toContain('jsonld');
    expect(rules(base([jsonld('{oops')]))).toContain('jsonld');
  });

  it('finds broken internal links, with no exemption for former server routes', () => {
    const links = page(
      '/a/',
      '<a href="/missing/">x</a><a href="/go/pt-x/">go</a><a href="https://x.example/">ext</a><a href="#main">skip</a>',
    );
    expect(rules(base([links]))).toEqual(['broken-link', 'broken-link']);
  });

  it('rejects unverified outlets in links and built profiles', () => {
    const tracked = page('/pt/outlet/x/', '<a href="https://x.example/" data-outlet="pt-x">x</a>');
    const found = rules(
      base([tracked], {
        hiddenOutletIds: new Set(['pt-x']),
        hiddenPaths: new Set(['/pt/outlet/x/']),
      }),
    );
    expect(found.filter((r) => r === 'unverified-outlet')).toHaveLength(2);
  });

  it('allows only built, indexable pages in the sitemap', () => {
    const pages = [page('/a/'), page('/b/', '', { robots: 'noindex' })];
    const found = rules(base(pages, { sitemapLocs: [`${SITE}/a/`, `${SITE}/b/`, `${SITE}/c/`] }));
    expect(found).toEqual(['sitemap', 'sitemap']);
  });
});
