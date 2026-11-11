/**
 * Static SEO audit of the built site (SPEC Phase 6). Pure functions over page HTML so the
 * rules can be tested; tools/seo-audit.ts reads dist/ and prints the findings.
 */
export interface Page {
  /** URL path with trailing slash, e.g. "/portugal/". */
  path: string;
  html: string;
}

export interface Finding {
  path: string;
  rule: string;
  message: string;
}

export interface AuditInput {
  siteUrl: string;
  pages: Page[];
  sitemapLocs: string[];
  /** Whether a path (internal link target) exists in the build. */
  exists: (path: string) => boolean;
  locales: number;
  /** Outlet ids that are not verified (candidate, retired): must never appear. */
  hiddenOutletIds: Set<string>;
  /** Profile paths those outlets would have: must never be built. */
  hiddenPaths: Set<string>;
}

export const TITLE = { min: 30, max: 60 } as const;
export const DESCRIPTION = { min: 110, max: 160 } as const;
const JSONLD_TYPES = new Set([
  'WebSite',
  'Organization',
  'BreadcrumbList',
  'ItemList',
  'NewsMediaOrganization',
  'FAQPage',
  'CollectionPage',
]);

const decode = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'");

const attr = (tag: string, name: string): string | null => {
  const match = new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return match ? decode(match[1] ?? match[2] ?? match[3] ?? '') : null;
};

const tags = (html: string, name: string): string[] =>
  html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];

export function readPage(html: string) {
  const head = html.slice(0, html.search(/<\/head>/i) + 1 || undefined);
  const title = decode(/<title>([\s\S]*?)<\/title>/i.exec(head)?.[1]?.trim() ?? '');
  const meta = (name: string) =>
    tags(head, 'meta')
      .map((t) => [attr(t, 'name') ?? attr(t, 'property'), attr(t, 'content')] as const)
      .find(([n]) => n === name)?.[1] ?? null;
  const links = tags(head, 'link');
  const canonical =
    links.map((t) => (attr(t, 'rel') === 'canonical' ? attr(t, 'href') : null)).find(Boolean) ??
    null;
  const hreflang = links
    .filter((t) => attr(t, 'rel') === 'alternate' && attr(t, 'hreflang'))
    .map((t) => ({ lang: attr(t, 'hreflang') ?? '', href: attr(t, 'href') ?? '' }));
  const jsonld = [
    ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi),
  ].map((m) => m[1] ?? '');
  const anchors = tags(html, 'a').map((t) => ({
    href: attr(t, 'href'),
    rel: attr(t, 'rel') ?? '',
    outlet: attr(t, 'data-outlet'),
  }));
  const robots = meta('robots') ?? '';
  return {
    title,
    description: meta('description'),
    canonical,
    hreflang,
    jsonld,
    anchors,
    noindex: /noindex/i.test(robots),
  };
}

const pathOf = (siteUrl: string, loc: string): string | null =>
  loc.startsWith(siteUrl) ? new URL(loc).pathname : null;

export function audit(input: AuditInput): Finding[] {
  const findings: Finding[] = [];
  const add = (path: string, rule: string, message: string) =>
    findings.push({ path, rule, message });
  const site = input.siteUrl.replace(/\/$/, '');
  const parsed = new Map(input.pages.map((p) => [p.path, readPage(p.html)]));
  const titles = new Map<string, string[]>();

  for (const [path, page] of parsed) {
    if (!page.title) add(path, 'title', 'Empty or missing <title>.');
    if (!page.noindex) {
      titles.set(page.title, [...(titles.get(page.title) ?? []), path]);
      if (page.title.length < TITLE.min || page.title.length > TITLE.max) {
        add(
          path,
          'title-length',
          `Title has ${page.title.length} characters (${TITLE.min}–${TITLE.max}): "${page.title}"`,
        );
      }
      const length = page.description?.length ?? 0;
      if (length < DESCRIPTION.min || length > DESCRIPTION.max) {
        add(
          path,
          'description-length',
          `Description has ${length} characters (${DESCRIPTION.min}–${DESCRIPTION.max}).`,
        );
      }
    }
    if (!page.canonical || !/^https:\/\//.test(page.canonical))
      add(path, 'canonical', 'Canonical missing or not absolute.');
    else if (!page.noindex && page.canonical !== `${site}${path}`) {
      add(path, 'canonical', `Canonical ${page.canonical} does not match the page URL.`);
    }

    if (input.locales <= 1 && page.hreflang.length > 0)
      add(path, 'hreflang', 'hreflang present with a single locale.');
    for (const alternate of page.hreflang) {
      const target = parsed.get(pathOf(site, alternate.href) ?? '');
      if (!target) add(path, 'hreflang', `${alternate.href} is not a page of this build.`);
      else if (!target.hreflang.some((a) => a.href === `${site}${path}`)) {
        add(path, 'hreflang', `${alternate.href} does not link back.`);
      }
    }

    for (const block of page.jsonld) {
      try {
        const data = JSON.parse(block) as unknown;
        for (const item of Array.isArray(data) ? data : [data]) {
          const type = (item as { '@type'?: string })['@type'];
          if (!type || !JSONLD_TYPES.has(type))
            add(path, 'jsonld', `Unexpected JSON-LD type ${String(type)}.`);
        }
      } catch {
        add(path, 'jsonld', 'JSON-LD block is not valid JSON.');
      }
    }

    for (const anchor of page.anchors) {
      const href = anchor.href;
      if (anchor.outlet && input.hiddenOutletIds.has(anchor.outlet)) {
        add(path, 'unverified-outlet', `Links to unverified outlet ${anchor.outlet}.`);
      }
      if (!href || !href.startsWith('/') || href.startsWith('//')) continue;
      // Fully static site: every internal link, badges included, must be a built file.
      const target = href.split(/[?#]/)[0] ?? '';
      if (!input.exists(target)) add(path, 'broken-link', `Internal link ${href} has no page.`);
    }
  }

  for (const [title, paths] of titles) {
    if (title && paths.length > 1)
      add(paths.join(', '), 'duplicate-title', `"${title}" is used ${paths.length} times.`);
  }

  for (const loc of input.sitemapLocs) {
    const path = pathOf(site, loc);
    const page = path ? parsed.get(path) : undefined;
    if (!page) add(loc, 'sitemap', 'Sitemap URL has no built page.');
    else if (page.noindex) add(loc, 'sitemap', 'Sitemap lists a noindex page.');
  }

  for (const path of parsed.keys()) {
    if (input.hiddenPaths.has(path))
      add(path, 'unverified-outlet', 'Profile page built for an unverified outlet.');
  }
  return findings;
}
