import type { Lang } from './lang';

/** A country name with the forms the interface copy needs ("o Brasil", "do Brasil", "no Brasil"). */
export interface Place {
  name: string;
  /** With its article, as a sentence object: "o Brasil", "Honduras". */
  the: string;
  /** After "de": "do Brasil", "dos Estados Unidos", "de Honduras". */
  of: string;
  /** After "em": "no Brasil", "nas Filipinas", "em Honduras". */
  in: string;
}

type Article = 'o' | 'a' | 'os' | 'as' | '';

/** Portuguese article of each country name; names without one ("Honduras", "Belize") take "". */
export const PT_ARTICLES: Record<string, Article> = {
  AO: '',
  AR: 'a',
  AT: 'a',
  AU: 'a',
  BE: 'a',
  BR: 'o',
  BZ: '',
  CA: 'o',
  CH: 'a',
  CI: 'a',
  CL: 'o',
  CM: '',
  CN: 'a',
  CO: 'a',
  CR: 'a',
  DE: 'a',
  DZ: 'a',
  EG: 'o',
  ES: 'a',
  ET: 'a',
  FR: 'a',
  GB: 'o',
  GH: '',
  GT: 'a',
  HN: '',
  ID: 'a',
  IE: 'a',
  IN: 'a',
  IT: 'a',
  JP: 'o',
  KE: 'o',
  KR: 'a',
  MA: 'o',
  MX: 'o',
  MY: 'a',
  MZ: '',
  NG: 'a',
  NI: 'a',
  NL: 'os',
  PA: 'o',
  PE: 'o',
  PH: 'as',
  PK: 'o',
  PL: 'a',
  PT: '',
  RU: 'a',
  SA: 'a',
  SE: 'a',
  SN: 'o',
  SV: '',
  TH: 'a',
  TN: 'a',
  TR: 'a',
  TZ: 'a',
  UG: '',
  US: 'os',
  VN: 'o',
  ZA: 'a',
  ZW: 'o',
};

const OF: Record<Article, string> = { o: 'do', a: 'da', os: 'dos', as: 'das', '': 'de' };
const IN: Record<Article, string> = { o: 'no', a: 'na', os: 'nos', as: 'nas', '': 'em' };

export function place(name: string, iso2: string, lang: Lang): Place {
  if (lang === 'en') return { name, the: name, of: name, in: name };
  const article = PT_ARTICLES[iso2] ?? '';
  return {
    name,
    the: article ? `${article} ${name}` : name,
    of: `${OF[article]} ${name}`,
    in: `${IN[article]} ${name}`,
  };
}
