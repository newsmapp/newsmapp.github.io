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
  AR: 'a',
  AU: 'a',
  BR: 'o',
  BZ: '',
  CA: 'o',
  CH: 'a',
  CL: 'o',
  CN: 'a',
  CO: 'a',
  CR: 'a',
  DE: 'a',
  EG: 'o',
  ES: 'a',
  FR: 'a',
  GB: 'o',
  GT: 'a',
  HN: '',
  ID: 'a',
  IN: 'a',
  IT: 'a',
  JP: 'o',
  KE: 'o',
  KR: 'a',
  MX: 'o',
  MY: 'a',
  NG: 'a',
  NI: 'a',
  NL: 'os',
  PA: 'o',
  PE: 'o',
  PH: 'as',
  PK: 'o',
  PT: '',
  RU: 'a',
  SA: 'a',
  SV: '',
  TH: 'a',
  TR: 'a',
  US: 'os',
  VN: 'o',
  ZA: 'a',
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
