import { CATEGORIES } from '../../src/schemas/catalog.schema';
import type { Locale } from '../../src/schemas/common';
import { THRESHOLDS, countryReadiness } from '../../src/lib/catalog/thresholds';
import type { Catalog } from '../../src/lib/catalog/validate';

const SHORT: Record<(typeof CATEGORIES)[number], string> = {
  'general-news': 'gen',
  politics: 'pol',
  sports: 'spo',
  economy: 'eco',
  investigative: 'inv',
  'tech-science': 'tec',
  broadcast: 'brd',
  regional: 'reg',
};

/** Coverage table: verified/candidate counts per category and what blocks publication. */
export function renderReport(catalog: Catalog, locales: readonly Locale[]): string {
  const lines: string[] = [];
  const header = ['iso', 'pub', 'ver', 'cand', ...CATEGORIES.map((c) => SHORT[c])];
  lines.push(header.map((h) => h.padStart(5)).join(''));
  for (const country of catalog.countries) {
    const outlets = (catalog.outlets.get(country.iso2) ?? []).filter((o) => o.status !== 'retired');
    const verified = outlets.filter((o) => o.status === 'verified');
    const candidates = outlets.filter((o) => o.status === 'candidate');
    const cells = CATEGORIES.map((category) => {
      const v = verified.filter((o) => o.categories.includes(category)).length;
      const c = candidates.filter((o) => o.categories.includes(category)).length;
      return `${v}/${c}`;
    });
    lines.push(
      [
        country.iso2,
        country.published ? 'yes' : 'no',
        String(verified.length),
        String(candidates.length),
        ...cells,
      ]
        .map((cell) => cell.padStart(5))
        .join(''),
    );
  }
  lines.push(
    '',
    `Cells are verified/candidate. Publication needs ≥${THRESHOLDS.countryMinOutlets} verified outlets in ≥${THRESHOLDS.countryMinCategories} categories and a reviewed seo_context.`,
    '',
  );
  for (const country of catalog.countries) {
    const readiness = countryReadiness(country, catalog.outlets.get(country.iso2) ?? [], locales);
    const pf = country.press_freedom ? '' : ' · press_freedom missing';
    lines.push(
      `${country.iso2}: ${readiness.ready ? 'ready' : `missing ${readiness.missing.join(', ')}`}${pf}`,
    );
  }
  return lines.join('\n');
}
