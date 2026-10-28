import {
  CATEGORY_LABELS,
  type Category,
  type Format,
  type OwnershipType,
  type Paywall,
} from '../../schemas/catalog.schema';
import type { Continent } from '../../schemas/common';
import type { Lang } from './lang';

/** Catalog vocabulary per language. Tags are short and always textual (never color alone). */
export interface Labels {
  category: Record<Category, string>;
  /** One- or two-word names for the home page topic switcher, where the full labels do not fit. */
  categoryShort: Record<Category, string>;
  continent: Record<Continent, string>;
  paywallTag: Record<Paywall, string>;
  paywallDescription: Record<Paywall, string>;
  /** Ownership tags shown in rows only for the types readers need flagged. */
  ownershipTag: Partial<Record<OwnershipType, string>>;
  ownership: Record<OwnershipType, string>;
  formatTag: Partial<Record<Format, string>>;
  format: Record<Format, string>;
  pressFreedom: Record<string, string>;
}

const en: Labels = {
  category: CATEGORY_LABELS,
  categoryShort: {
    'general-news': 'National news',
    politics: 'Politics',
    sports: 'Sports',
    economy: 'Business',
    investigative: 'Investigative',
    'tech-science': 'Tech & science',
    broadcast: 'TV & radio',
    regional: 'Regional',
  },
  continent: {
    africa: 'Africa',
    antarctica: 'Antarctica',
    asia: 'Asia',
    europe: 'Europe',
    'north-america': 'North America',
    oceania: 'Oceania',
    'south-america': 'South America',
  },
  paywallTag: { free: 'Free', metered: 'Metered', freemium: 'Freemium', hard: 'Paywall' },
  paywallDescription: {
    free: 'Free to read',
    metered: 'A few free articles, then a subscription',
    freemium: 'Some articles free, premium content paid',
    hard: 'Subscription required',
  },
  ownershipTag: {
    'state-controlled': 'STATE',
    'public-service': 'PUBLIC',
    nonprofit: 'NONPROFIT',
  },
  ownership: {
    private: 'Private',
    'public-service': 'Public service',
    'state-controlled': 'State-controlled',
    nonprofit: 'Nonprofit',
    cooperative: 'Cooperative',
    unknown: 'Unknown',
  },
  formatTag: { 'broadcaster-tv': 'TV', 'broadcaster-radio': 'RADIO' },
  format: {
    newspaper: 'Newspaper',
    'digital-native': 'Digital-native',
    'broadcaster-tv': 'TV broadcaster',
    'broadcaster-radio': 'Radio broadcaster',
    magazine: 'Magazine',
    agency: 'News agency',
  },
  pressFreedom: {
    good: 'Good',
    satisfactory: 'Satisfactory',
    problematic: 'Problematic',
    difficult: 'Difficult',
    'very-serious': 'Very serious',
  },
};

const pt: Labels = {
  category: {
    'general-news': 'Principais notícias nacionais',
    politics: 'Política e governo',
    sports: 'Esportes',
    economy: 'Negócios, finanças e mercados',
    investigative: 'Investigativo e checagem',
    'tech-science': 'Tecnologia, ciência e cultura',
    broadcast: 'TV e rádio',
    regional: 'Regional e local',
  },
  categoryShort: {
    'general-news': 'Nacionais',
    politics: 'Política',
    sports: 'Esportes',
    economy: 'Negócios',
    investigative: 'Investigativo',
    'tech-science': 'Tecnologia e ciência',
    broadcast: 'TV e rádio',
    regional: 'Regional',
  },
  continent: {
    africa: 'África',
    antarctica: 'Antártida',
    asia: 'Ásia',
    europe: 'Europa',
    'north-america': 'América do Norte',
    oceania: 'Oceania',
    'south-america': 'América do Sul',
  },
  paywallTag: { free: 'Grátis', metered: 'Com limite', freemium: 'Freemium', hard: 'Paywall' },
  paywallDescription: {
    free: 'Leitura gratuita',
    metered: 'Alguns artigos grátis, depois assinatura',
    freemium: 'Parte dos artigos grátis, conteúdo premium pago',
    hard: 'Exige assinatura',
  },
  ownershipTag: {
    'state-controlled': 'ESTATAL',
    'public-service': 'PÚBLICO',
    nonprofit: 'SEM LUCRO',
  },
  ownership: {
    private: 'Privado',
    'public-service': 'Serviço público',
    'state-controlled': 'Controlado pelo Estado',
    nonprofit: 'Sem fins lucrativos',
    cooperative: 'Cooperativa',
    unknown: 'Desconhecido',
  },
  formatTag: { 'broadcaster-tv': 'TV', 'broadcaster-radio': 'RÁDIO' },
  format: {
    newspaper: 'Jornal',
    'digital-native': 'Nativo digital',
    'broadcaster-tv': 'Emissora de TV',
    'broadcaster-radio': 'Emissora de rádio',
    magazine: 'Revista',
    agency: 'Agência de notícias',
  },
  pressFreedom: {
    good: 'Boa',
    satisfactory: 'Satisfatória',
    problematic: 'Problemática',
    difficult: 'Difícil',
    'very-serious': 'Muito grave',
  },
};

export const LABELS: Record<Lang, Labels> = { en, pt };
