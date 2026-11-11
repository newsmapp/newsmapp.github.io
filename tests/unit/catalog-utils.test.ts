import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvRecords } from '@/lib/csv';
import { hash, initials, monogramSvg } from '@/lib/catalog/monogram';
import { slugify } from '@/lib/catalog/slugify';
import { badgeEntries, toPublicCatalog } from '@/lib/catalog/public';
import { validateCatalog } from '@/lib/catalog/validate';
import { FIXTURES, loadInput } from '../helpers/catalog';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas, CRLF and a BOM', () => {
    const csv = '﻿name,pitch\r\n"A, B","He said ""hi"""\r\nC,"multi\nline"\n';
    expect(parseCsv(csv)).toEqual([
      ['name', 'pitch'],
      ['A, B', 'He said "hi"'],
      ['C', 'multi\nline'],
    ]);
  });

  it('maps records by header and rejects ragged rows', () => {
    expect(parseCsvRecords('a,b\n1, 2 \n')).toEqual([{ a: '1', b: '2' }]);
    expect(parseCsvRecords('')).toEqual([]);
    expect(() => parseCsvRecords('a,b\n1\n')).toThrow(/Row 2/);
    expect(() => parseCsv('"open')).toThrow(/Unterminated/);
  });
});

describe('slugify', () => {
  it.each([
    ['Folha de S.Paulo', 'folha-de-s-paulo'],
    ['Doğruluk Payı', 'dogruluk-payi'],
    ['Süddeutsche Zeitung', 'suddeutsche-zeitung'],
    ['L’Équipe', 'l-equipe'],
    ['Straße & Co', 'strasse-and-co'],
    ['  --  ', ''],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('monogram', () => {
  it('derives initials from meaningful words', () => {
    expect(initials('The New York Times')).toBe('NY');
    expect(initials('Le Monde')).toBe('M');
    expect(initials('kicker')).toBe('K');
    expect(initials('朝日新聞')).toBe('朝');
    expect(initials('...')).toBe('?');
    expect(initials('The')).toBe('T');
  });

  it('is deterministic and escapes markup', () => {
    expect(hash('us-nyt')).toBe(hash('us-nyt'));
    expect(hash('a')).not.toBe(hash('b'));
    const svg = monogramSvg('x-a', 'A <b>');
    expect(svg).toBe(monogramSvg('x-a', 'A <b>'));
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('width="40"');
  });
});

describe('public catalog', () => {
  const { catalog } = validateCatalog(loadInput(FIXTURES));
  const publicCatalog = toPublicCatalog(catalog, ['en'], (id) => id === 'pt-morning-ledger');

  it('contains only published countries and verified outlets', () => {
    expect(publicCatalog.countries.map((c) => c.iso2)).toEqual(['BR', 'FR', 'PT', 'ES']);
    const outlets = publicCatalog.countries.flatMap((c) => c.outlets);
    expect(outlets).toHaveLength(72);
    expect(outlets.some((o) => o.slug === 'unverified-gazette' || o.slug === 'closed-times')).toBe(
      false,
    );
    expect(outlets[0]).not.toHaveProperty('health');
  });

  it('points to a raster icon when downloaded, else to the monogram', () => {
    const pt = publicCatalog.countries.find((c) => c.iso2 === 'PT')!;
    expect(pt.outlets.find((o) => o.id === 'pt-morning-ledger')?.icon).toBe(
      '/icons/pt-morning-ledger.webp',
    );
    expect(pt.outlets.find((o) => o.id === 'pt-lab-notes')?.icon).toBe('/icons/pt-lab-notes.svg');
  });

  it('lists the badges to prerender', () => {
    const badges = badgeEntries(publicCatalog);
    expect(badges.find((b) => b.id === 'pt-morning-ledger')).toEqual({
      id: 'pt-morning-ledger',
      country_slug: 'portugal',
      slug: 'morning-ledger',
      country_name: 'Portugal',
      position: 1,
      category: 'general-news',
    });
    expect(badges.find((b) => b.id === 'pt-unverified-gazette')).toBeUndefined();
  });

  it('adds unpublished countries and candidates, never retired outlets, in a drafts preview', () => {
    const preview = toPublicCatalog(catalog, ['en'], () => false, { drafts: true });
    expect(preview.countries.map((c) => c.iso2)).toContain('IT');
    const slugs = preview.countries.flatMap((c) => c.outlets.map((o) => o.slug));
    expect(slugs).toContain('unverified-gazette');
    expect(slugs).not.toContain('closed-times');
  });
});
