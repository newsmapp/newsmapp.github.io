/**
 * Validates the catalog and writes the build-time modules the site imports:
 * - src/generated/catalog.json: published countries with verified outlets (pages)
 * - src/generated/runtime-catalog.json: id → url/name map (Worker routes)
 * Also writes deterministic monogram SVGs for outlets without a downloaded icon.
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { monogramSvg } from '../src/lib/catalog/monogram';
import { toPublicCatalog, toRuntimeCatalog } from '../src/lib/catalog/public';
import { validateCatalog } from '../src/lib/catalog/validate';
import { ICONS_DIR } from './catalog-cli/icons';
import { enabledLocales, loadCatalogInput, writeJson } from './catalog-cli/io';

const locales = enabledLocales();
const { catalog, issues } = validateCatalog(loadCatalogInput());
const errors = issues.filter((issue) => issue.severity === 'error');
if (errors.length > 0) {
  for (const issue of errors) console.error(`ERROR ${issue.file}: ${issue.message}`);
  process.exit(1);
}

const publicCatalog = toPublicCatalog(catalog, locales, (id) =>
  existsSync(`${ICONS_DIR}/${id}.webp`),
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
writeJson('src/generated/runtime-catalog.json', toRuntimeCatalog(publicCatalog));
// Pages import the sponsorship snapshot; without a snapshot run, nothing is sponsored.
if (!existsSync('src/generated/sponsorships.json'))
  writeJson('src/generated/sponsorships.json', []);
const outletCount = publicCatalog.countries.reduce((n, c) => n + c.outlets.length, 0);
console.log(
  `Catalog: ${publicCatalog.countries.length} published countries, ${outletCount} verified outlets`,
);
