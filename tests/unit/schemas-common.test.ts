import { describe, expect, it } from 'vitest';
import { httpsUrl, slug, text } from '@/schemas/common';
import { geoCountriesSchema } from '@/schemas/geo.schema';
import geo from '../../data/geo/countries.json';

describe('common schemas', () => {
  it('accepts only absolute https URLs with a real hostname', () => {
    expect(httpsUrl.safeParse('https://www.example.com/news').success).toBe(true);
    expect(httpsUrl.safeParse('http://www.example.com').success).toBe(false);
    expect(httpsUrl.safeParse('https://localhost').success).toBe(false);
    expect(httpsUrl.safeParse('javascript:alert(1)').success).toBe(false);
    expect(httpsUrl.safeParse('not a url').success).toBe(false);
  });

  it('rejects control characters and blank text', () => {
    expect(text.safeParse('  ').success).toBe(false);
    expect(text.safeParse('ok\u0007').success).toBe(false);
    expect(text.parse('  Folha  ')).toBe('Folha');
  });

  it('validates slugs', () => {
    expect(slug.safeParse('new-york-times').success).toBe(true);
    expect(slug.safeParse('New York').success).toBe(false);
    expect(slug.safeParse('-lead').success).toBe(false);
  });
});

describe('geo data', () => {
  it('matches the schema and keeps editorial continent placement', () => {
    const countries = geoCountriesSchema.parse(geo);
    const byIso = new Map(countries.map((c) => [c.iso2, c]));
    expect(byIso.get('RU')).toMatchObject({ continent: 'europe', also_in: ['asia'] });
    expect(byIso.get('TR')).toMatchObject({ continent: 'asia', also_in: ['europe'] });
    expect(countries.length).toBeGreaterThan(240);
  });
});
