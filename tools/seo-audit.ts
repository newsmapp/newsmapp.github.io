/**
 * pnpm seo:audit [dist]: checks titles, descriptions, canonicals, hreflang, JSON-LD,
 * internal links, the sitemap and that no unverified outlet reached the build.
 * Exits 1 when anything is found.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { validateCatalog } from '../src/lib/catalog/validate';
import { audit, type Page } from './seo-audit/audit';
import { enabledLocales, loadCatalogInput } from './catalog-cli/io';
import { localizePath, parseLangs } from '../src/lib/i18n/lang';

const root = process.argv[2] ?? 'dist';
const siteUrl = (process.env.SITE_URL ?? 'https://newsmapp.github.io').replace(/\/$/, '');

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory())
      return name === 'pagefind' || name === '_astro' ? [] : htmlFiles(full);
    return name.endsWith('.html') ? [full] : [];
  });
}

const toPath = (file: string): string => {
  const rel = `/${relative(root, file).split(sep).join('/')}`;
  return rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel;
};

const pages: Page[] = htmlFiles(root)
  .filter((file) => !file.endsWith(`${sep}404.html`))
  .map((file) => ({ path: toPath(file), html: readFileSync(file, 'utf8') }));

// One sitemap per language (sitemap-en.xml, sitemap-pt.xml); the index only points at them.
const sitemapLocs = readdirSync(root)
  .filter((name) => /^sitemap-[a-z]{2}\.xml$/.test(name))
  .flatMap((name) => [...readFileSync(join(root, name), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)])
  .map((m) => m[1] ?? '');

const { catalog } = validateCatalog(loadCatalogInput());
const langs = parseLangs(enabledLocales().join(','));
const hidden = catalog.countries.flatMap((country) =>
  (catalog.outlets.get(country.iso2) ?? [])
    .filter((o) => o.status !== 'verified')
    .flatMap((o) =>
      langs.map((lang) => ({
        id: o.id,
        path: localizePath(`/${country.slug}/outlet/${o.slug}/`, lang),
      })),
    ),
);

const findings = audit({
  siteUrl,
  pages,
  sitemapLocs,
  exists: (path) =>
    existsSync(join(root, path, 'index.html')) ||
    (!path.endsWith('/') && existsSync(join(root, path))),
  locales: langs.length,
  hiddenOutletIds: new Set(hidden.map((h) => h.id)),
  hiddenPaths: new Set(hidden.map((h) => h.path)),
});

for (const finding of findings)
  console.log(`${finding.rule.padEnd(20)} ${finding.path}  ${finding.message}`);
console.log(
  `SEO audit: ${pages.length} pages, ${sitemapLocs.length} sitemap URLs, ${findings.length} finding(s).`,
);
process.exit(findings.length > 0 ? 1 : 0);
