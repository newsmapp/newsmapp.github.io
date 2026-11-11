/**
 * Validates the catalog and writes the build-time modules the site imports:
 * - src/generated/catalog.json: published countries with verified outlets (pages and badges)
 * Also writes deterministic monogram SVGs for outlets without a downloaded icon.
 *
 * CATALOG_DRAFTS=1 builds a local preview with every country and candidate outlet. It is refused
 * on GitHub Actions so unreviewed outlets can never be deployed.
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { monogramSvg } from '../src/lib/catalog/monogram';
import { toPublicCatalog } from '../src/lib/catalog/public';
import { validateCatalog } from '../src/lib/catalog/validate';
import { ICONS_DIR } from './catalog-cli/icons';
import { enabledLocales, loadCatalogInput, writeJson } from './catalog-cli/io';

const drafts = process.env.CATALOG_DRAFTS === '1';
if (drafts && process.env.GITHUB_ACTIONS) {
  console.error('CATALOG_DRAFTS is a local preview only; unset it to build for deploy.');
  process.exit(1);
}
const locales = enabledLocales();
const { catalog, issues } = validateCatalog(loadCatalogInput());
const errors = issues.filter((issue) => issue.severity === 'error');
if (errors.length > 0) {
  for (const issue of errors) console.error(`ERROR ${issue.file}: ${issue.message}`);
  process.exit(1);
}

const publicCatalog = toPublicCatalog(
  catalog,
  locales,
  (id) => existsSync(`${ICONS_DIR}/${id}.webp`),
  { drafts },
);
mkdirSync('src/generated', { recursive: true });
mkdirSync(ICONS_DIR, { recursive: true });
for (const outlet of publicCatalog.countries.flatMap((c) => c.outlets)) {
  if (outlet.icon.endsWith('.svg'))
    writeFileSync(`public${outlet.icon}`, monogramSvg(outlet.id, outlet.name));
}
// Local SVG flags (flag-icons, MIT) for every catalog country: no external requests at runtime.
mkdirSync('public/flags', { recursive: true });
for (const country of catalog.countries) {
  const iso = country.iso2.toLowerCase();
  copyFileSync(`node_modules/flag-icons/flags/4x3/${iso}.svg`, `public/flags/${iso}.svg`);
}
writeJson('src/generated/catalog.json', publicCatalog);
const outletCount = publicCatalog.countries.reduce((n, c) => n + c.outlets.length, 0);
console.log(
  drafts
    ? `Catalog DRAFT PREVIEW: ${publicCatalog.countries.length} countries, ${outletCount} outlets (not for deploy)`
    : `Catalog: ${publicCatalog.countries.length} published countries, ${outletCount} verified outlets`,
);
