import { describe, expect, it } from 'vitest';
import { validateCatalog, type CatalogInput } from '@/lib/catalog/validate';
import { FIXTURES, clone, loadInput } from '../helpers/catalog';

type Mutable = Record<string, unknown>;
const fixture = loadInput(FIXTURES);

function errorsAfter(mutate: (input: CatalogInput) => void): string[] {
  const input = clone(fixture);
  mutate(input);
  return validateCatalog(input)
    .issues.filter((i) => i.severity === 'error')
    .map((i) => `${i.file}: ${i.message}`);
}

const outletsOf = (input: CatalogInput, iso: string) =>
  input.outlets.find((f) => f.file === `outlets/${iso}.json`)?.data as Mutable[];
const countryOf = (input: CatalogInput, iso: string) =>
  input.countries.find((f) => f.file === `countries/${iso}.json`)?.data as Mutable;

describe('validateCatalog', () => {
  it('accepts the fixture catalog', () => {
    const { catalog, issues } = validateCatalog(clone(fixture));
    expect(issues).toEqual([]);
    expect(catalog.countries).toHaveLength(5);
  });

  it('accepts the real catalog', () => {
    const { issues } = validateCatalog(loadInput('data'));
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('rejects non-https and malformed URLs', () => {
    const errors = errorsAfter((input) => {
      outletsOf(input, 'pt')[0]!.url = 'http://insecure.example.com/';
      outletsOf(input, 'pt')[1]!.url = '[Site](https://md.example.com)';
    });
    expect(errors.filter((e) => e.includes('url'))).toHaveLength(2);
  });

  it('rejects duplicate ids across files and duplicate slugs within a country', () => {
    const errors = errorsAfter((input) => {
      const pt = outletsOf(input, 'pt');
      pt.push({ ...pt[0]!, url: 'https://other.example.com/' });
    });
    expect(errors.some((e) => e.includes('duplicate id'))).toBe(true);
    expect(errors.some((e) => e.includes('duplicate slug'))).toBe(true);
  });

  it('rejects ids with the wrong country prefix', () => {
    const errors = errorsAfter((input) => {
      const outlet = outletsOf(input, 'pt')[0]!;
      outlet.id = `es-${String(outlet.slug)}`;
    });
    expect(errors.some((e) => e.includes('must start with "pt-"'))).toBe(true);
  });

  it('rejects repeated ranks in the same category', () => {
    const errors = errorsAfter((input) => {
      const pt = outletsOf(input, 'pt');
      pt[1]!.ranks = { 'general-news': 1 };
    });
    expect(errors.some((e) => e.includes('rank 1 in general-news'))).toBe(true);
  });

  it('enforces pitch length and presence for enabled locales', () => {
    const errors = errorsAfter((input) => {
      outletsOf(input, 'pt')[0]!.pitch = { en: 'Too short.' };
      outletsOf(input, 'pt')[1]!.pitch = {};
    });
    expect(errors.some((e) => e.includes('chars (60–140)'))).toBe(true);
    expect(errors.some((e) => e.includes('pitch.en is required'))).toBe(true);
  });

  it('rejects unknown ISO codes, wrong iso3, wrong continent and reserved slugs', () => {
    const errors = errorsAfter((input) => {
      const pt = countryOf(input, 'pt');
      pt.iso3 = 'XXX';
      pt.continent = 'asia';
      pt.slug = 'go';
      pt.neighbors = ['ZZ'];
    });
    expect(errors.join('\n')).toMatch(/iso3 should be PRT/);
    expect(errors.join('\n')).toMatch(/continent should be europe/);
    expect(errors.join('\n')).toMatch(/slug "go" is reserved/);
    expect(errors.join('\n')).toMatch(/unknown neighbor ZZ/);
  });

  it('rejects a country file whose name does not match its iso2', () => {
    const errors = errorsAfter((input) => {
      const pt = input.countries.find((f) => f.file === 'countries/pt.json')!;
      pt.file = 'countries/xx.json';
    });
    expect(errors.some((e) => e.includes('does not match file'))).toBe(true);
  });

  it('rejects outlets without a country file', () => {
    const errors = errorsAfter((input) => {
      input.outlets.push({ file: 'outlets/de.json', data: [] });
    });
    expect(errors.some((e) => e.includes('no country file for DE'))).toBe(true);
  });

  it('rejects duplicate country slugs', () => {
    const errors = errorsAfter((input) => {
      countryOf(input, 'es').slug = 'portugal';
    });
    expect(errors.some((e) => e.includes('already used by'))).toBe(true);
  });

  it('requires seo_context and name for enabled locales', () => {
    const errors = errorsAfter((input) => {
      const it = countryOf(input, 'it');
      it.seo_context = {};
      it.name = { pt: 'Itália' };
    });
    expect(errors.some((e) => e.includes('seo_context.en is required'))).toBe(true);
    expect(errors.some((e) => e.includes('name.en is required'))).toBe(true);
  });

  it('fails a published country below the threshold', () => {
    const errors = errorsAfter((input) => {
      countryOf(input, 'it').published = true;
    });
    expect(errors.some((e) => e.includes('published but below threshold'))).toBe(true);
  });

  it('enforces outlet invariants from the schema', () => {
    const errors = errorsAfter((input) => {
      const [a, b, c, d, e] = outletsOf(input, 'pt');
      a!.primary_category = 'sports';
      b!.ownership_type = 'state-controlled';
      c!.political_lean = { value: 'left', source_url: null };
      d!.categories = ['general-news', 'regional'];
      d!.ranks = { 'general-news': 50, regional: 1 };
      e!.verified_at = null;
    });
    const joined = errors.join('\n');
    expect(joined).toMatch(/primary_category must be one of categories/);
    expect(joined).toMatch(/state-controlled requires a source/);
    expect(joined).toMatch(/requires a source_url/);
    expect(joined).toMatch(/region is required/);
    expect(joined).toMatch(/verified outlets need verified_at/);
  });

  it('warns when a verified outlet fails its health check', () => {
    const input = clone(fixture);
    outletsOf(input, 'pt')[0]!.health = {
      last_checked: '2026-01-01',
      http_status: 404,
      final_url: null,
    };
    const { issues } = validateCatalog(input);
    expect(issues).toContainEqual(expect.objectContaining({ severity: 'warning' }));
  });

  it('reports invalid geo data', () => {
    const input = clone(fixture);
    input.geo = [{ iso2: 'nope' }];
    expect(validateCatalog(input).issues[0]?.file).toBe('geo/countries.json');
  });
});
