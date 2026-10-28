import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { langFromPath, localizePath, parseLangs, stripLang } from '@/lib/i18n/lang';
import { PT_ARTICLES, place } from '@/lib/i18n/place';
import { requestLang } from '@/server/messages';

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

  it('reads the form language from Accept-Language', () => {
    const lang = (value?: string) =>
      requestLang(
        new Request('https://newsmap.example/', {
          headers: value ? { 'accept-language': value } : {},
        }),
      );
    expect(lang('pt-BR')).toBe('pt');
    expect(lang('pt')).toBe('pt');
    expect(lang('de-DE,de;q=0.9')).toBe('en');
    expect(lang()).toBe('en');
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
