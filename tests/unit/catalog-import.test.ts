import { describe, expect, it } from 'vitest';
import { importCandidates } from '@/lib/catalog/import';
import { outletSchema } from '@/schemas/catalog.schema';
import { validateCatalog } from '@/lib/catalog/validate';
import { FIXTURES, loadInput } from '../helpers/catalog';

const { catalog } = validateCatalog(loadInput(FIXTURES));
const existing = catalog.outlets.get('PT')!;

const row = (overrides: Record<string, string> = {}) => ({
  name: 'Jornal de Teste',
  url: 'https://jornal.example.com/',
  categories: 'economy|regional',
  region: 'Lisbon',
  pitch: 'A fictional regional business paper used to test the import pipeline end to end.',
  ...overrides,
});

describe('importCandidates', () => {
  it('creates schema-valid candidates with ranks after the existing ones', () => {
    const { added } = importCandidates('PT', existing, [row()], 'pt');
    const outlet = added[0]!;
    expect(outletSchema.parse(outlet)).toBeTruthy();
    expect(outlet).toMatchObject({
      id: 'pt-jornal-de-teste',
      status: 'candidate',
      language: 'pt',
      primary_category: 'economy',
      ranks: { economy: 6, regional: 1 },
      political_lean: { value: 'unrated', source_url: null },
      paywall: 'free',
      ownership_type: 'unknown',
    });
  });

  it('never touches existing outlets and skips their ids', () => {
    const { added, skipped } = importCandidates(
      'PT',
      existing,
      [row({ name: 'Portugal Morning Ledger', slug: 'morning-ledger' })],
      'pt',
    );
    expect(added).toEqual([]);
    expect(skipped).toEqual(['pt-morning-ledger']);
  });

  it('records the ownership source and parses optional columns', () => {
    const { added } = importCandidates(
      'PT',
      [],
      [
        row({
          ownership_type: 'state-controlled',
          ownership_source: 'https://en.wikipedia.org/wiki/Example',
          founded_year: '1999',
          editor_pick: 'y',
          format: 'agency',
          paywall: 'hard',
          language: 'en',
          owner: 'State',
        }),
      ],
      'pt',
    );
    expect(added[0]).toMatchObject({
      sources: [{ field: 'ownership_type', url: 'https://en.wikipedia.org/wiki/Example' }],
      founded_year: 1999,
      editor_pick: true,
      format: 'agency',
      paywall: 'hard',
      language: 'en',
      owner: 'State',
    });
  });

  it('assigns increasing ranks within the same import', () => {
    const { added } = importCandidates('PT', [], [row({ name: 'A' }), row({ name: 'B' })], 'pt');
    expect(added.map((o) => o.ranks.economy)).toEqual([1, 2]);
  });

  it('ignores rows for other countries', () => {
    expect(importCandidates('PT', [], [row({ country: 'ES' })], 'pt').added).toEqual([]);
  });

  it('reports the offending row for invalid enums and missing fields', () => {
    expect(() => importCandidates('PT', [], [row({ paywall: 'sometimes' })], 'pt')).toThrow(
      /row 2: paywall/,
    );
    expect(() => importCandidates('PT', [], [row({ categories: '' })], 'pt')).toThrow(
      /categories is required/,
    );
    expect(() => importCandidates('PT', [], [row({ name: '' })], 'pt')).toThrow(/name is required/);
  });
});
