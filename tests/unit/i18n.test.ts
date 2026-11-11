import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { langFromPath, localizePath, parseLangs, stripLang } from '@/lib/i18n/lang';
import { PT_ARTICLES, place } from '@/lib/i18n/place';
import { UI_TEXT } from '@/lib/i18n/ui';

describe('language paths', () => {
  it('keeps English at the root and the others under /<lang>/', () => {
    expect(localizePath('/brazil/sports/', 'en')).toBe('/brazil/sports/');
    expect(localizePath('/brazil/sports/', 'pt')).toBe('/pt/brazil/sports/');
    expect(langFromPath('/pt/brazil/')).toBe('pt');
    expect(langFromPath('/portugal/')).toBe('en');
    expect(langFromPath('/en/brazil/')).toBe('en');
    expect(stripLang('/pt/brazil/')).toBe('/brazil/');
    expect(stripLang('/pt/')).toBe('/');
    expect(stripLang('/portugal/')).toBe('/portugal/');
  });

  it('parses ENABLED_LOCALES with English first and unknown values dropped', () => {
    expect(parseLangs('en')).toEqual(['en']);
    expect(parseLangs('pt, en')).toEqual(['en', 'pt']);
    expect(parseLangs('pt,xx')).toEqual(['en', 'pt']);
    expect(parseLangs('')).toEqual(['en']);
  });
});

describe('place', () => {
  it('adds the Portuguese article and its contractions', () => {
    expect(place('Brasil', 'BR', 'pt')).toEqual({
      name: 'Brasil',
      the: 'o Brasil',
      of: 'do Brasil',
      in: 'no Brasil',
    });
    expect(place('Estados Unidos', 'US', 'pt').in).toBe('nos Estados Unidos');
    expect(place('Filipinas', 'PH', 'pt').of).toBe('das Filipinas');
    expect(place('Honduras', 'HN', 'pt')).toMatchObject({ the: 'Honduras', in: 'em Honduras' });
    expect(place('Brazil', 'BR', 'en').in).toBe('Brazil');
  });

  it('has an article for every country in the catalog', () => {
    const isos = readdirSync('data/countries')
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length).toUpperCase());
    expect(isos.filter((iso) => !(iso in PT_ARTICLES))).toEqual([]);
  });
});

describe('interface copy', () => {
  /**
   * One argument that works as every type the copy functions take: a string ("Sports"), a number
   * (3, through valueOf) and a Place (Portugal).
   */
  class Arg extends String {
    override valueOf = () => 3 as unknown as string;
    readonly name = 'Portugal';
    readonly the = 'Portugal';
    readonly of = 'de Portugal';
    readonly in = 'em Portugal';
  }
  const render = (value: unknown, path: string): [string, string][] => {
    if (typeof value === 'string') return [[path, value]];
    if (typeof value === 'function') {
      const out = (value as (...a: unknown[]) => unknown)(
        ...Array.from({ length: value.length }, () => new Arg('Sports')),
      );
      return Array.isArray(out)
        ? out.map((text, i): [string, string] => [`${path}[${i}]`, String(text)])
        : [[path, String(out)]];
    }
    if (value && typeof value === 'object')
      return Object.entries(value).flatMap(([k, v]) => render(v, `${path}.${k}`));
    return [];
  };

  it('has the same keys in every language', () => {
    const keys = (lang: 'en' | 'pt') => render(UI_TEXT[lang], lang).map(([p]) => p.slice(3));
    expect(keys('pt')).toEqual(keys('en'));
  });

  it('renders every string without gaps or leftover placeholders', () => {
    for (const lang of ['en', 'pt'] as const) {
      for (const [path, text] of render(UI_TEXT[lang], lang)) {
        // Empty only where a language has nothing to add (the English translation note).
        if (path === 'en.prose.translation') continue;
        expect(text, path).not.toBe('');
        expect(text, path).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });
});
