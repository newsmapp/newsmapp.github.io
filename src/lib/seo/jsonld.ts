import { absoluteUrl } from './meta';

type Thing = Record<string, unknown>;

/** Serializes JSON-LD safe for embedding in a <script> element. */
export function serializeJsonLd(data: Thing | Thing[]): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** No SearchAction: Google retired the sitelinks search box. */
export const website = (siteUrl: string): Thing => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'NewsMap',
  url: absoluteUrl(siteUrl, '/'),
});

export const organization = (siteUrl: string): Thing => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'NewsMap',
  url: absoluteUrl(siteUrl, '/'),
});

export const breadcrumbList = (
  siteUrl: string,
  items: { label: string; href: string }[],
): Thing => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.label,
    item: absoluteUrl(siteUrl, item.href),
  })),
});

export const itemList = (name: string, items: { name: string; url: string }[]): Thing => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name,
  numberOfItems: items.length,
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    url: item.url,
  })),
});

export interface OrganizationFacts {
  name: string;
  url: string;
  foundingYear: number | null;
  /** Only when the owner is sourced. */
  parentOrganization: string | null;
  sameAs?: string[];
}

export const newsMediaOrganization = (facts: OrganizationFacts): Thing => ({
  '@context': 'https://schema.org',
  '@type': 'NewsMediaOrganization',
  name: facts.name,
  url: facts.url,
  ...(facts.foundingYear ? { foundingDate: String(facts.foundingYear) } : {}),
  ...(facts.parentOrganization
    ? { parentOrganization: { '@type': 'Organization', name: facts.parentOrganization } }
    : {}),
});

export const faqPage = (faq: { q: string; a: string }[]): Thing => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
});
