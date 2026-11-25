import { describe, expect, it } from 'vitest';
import { searchKey } from '@/lib/search';

describe('searchKey', () => {
  it('ignores case and accents', () => {
    expect(searchKey('Médor')).toBe('medor');
    expect(searchKey('Göteborgs-Posten')).toBe('goteborgs-posten');
    expect(searchKey('Açoriano Oriental')).toBe('acoriano oriental');
    expect(searchKey('Le Soir d’Algérie')).toBe('le soir d’algerie');
  });

  it('folds letters Unicode does not decompose', () => {
    expect(searchKey('Przegląd Łódzki')).toBe('przeglad lodzki');
    expect(searchKey('Straße Øst')).toBe('strasse ost');
  });

  it('matches whatever the user types against the stored key', () => {
    expect(searchKey('  MEDOR ')).toBe(searchKey('Médor'));
  });
});
