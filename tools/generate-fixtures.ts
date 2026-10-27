/**
 * Writes a deterministic fictional catalog to tests/fixtures/catalog for E2E and unit tests.
 * Real ISO codes, invented outlets on example.com. Run: pnpm fixtures:generate
 */
import { mkdirSync, rmSync } from 'node:fs';
import type { Category, Country, Outlet } from '../src/schemas/catalog.schema';
import { writeJson } from './catalog-cli/io';
import geo from '../data/geo/countries.json';

const ROOT = 'tests/fixtures/catalog';
const DATE = '2026-01-15';

interface Spec {
  iso2: string;
  slug: string;
  name: string;
  published: boolean;
}

const COUNTRIES: Spec[] = [
  { iso2: 'PT', slug: 'portugal', name: 'Portugal', published: true },
  { iso2: 'ES', slug: 'spain', name: 'Spain', published: true },
  { iso2: 'FR', slug: 'france', name: 'France', published: true },
  { iso2: 'BR', slug: 'brazil', name: 'Brazil', published: true },
  { iso2: 'IT', slug: 'italy', name: 'Italy', published: false },
];

/** [name, categories, paywall, ownership, format] — 18 verified outlets per published country. */
const OUTLETS: [
  string,
  Category[],
  Outlet['paywall'],
  Outlet['ownership_type'],
  Outlet['format'],
][] = [
  ['Morning Ledger', ['general-news', 'politics'], 'metered', 'private', 'newspaper'],
  ['National Courier', ['general-news'], 'free', 'private', 'newspaper'],
  [
    'Public Radio News',
    ['general-news', 'broadcast'],
    'free',
    'public-service',
    'broadcaster-radio',
  ],
  ['Wire Service', ['general-news'], 'free', 'cooperative', 'agency'],
  ['Evening Standard Post', ['general-news'], 'hard', 'private', 'newspaper'],
  ['Daily Digest', ['general-news'], 'freemium', 'private', 'digital-native'],
  ['Market Journal', ['economy'], 'hard', 'private', 'newspaper'],
  ['Finance Weekly', ['economy'], 'metered', 'private', 'magazine'],
  ['Trade Monitor', ['economy'], 'free', 'private', 'digital-native'],
  ['Capital Review', ['economy', 'politics'], 'freemium', 'private', 'magazine'],
  ['Exchange Report', ['economy'], 'free', 'nonprofit', 'digital-native'],
  ['Stadium Daily', ['sports'], 'free', 'private', 'newspaper'],
  ['Match Report', ['sports'], 'free', 'private', 'digital-native'],
  ['Sports Channel', ['sports', 'broadcast'], 'free', 'private', 'broadcaster-tv'],
  ['Track and Field', ['sports'], 'metered', 'private', 'magazine'],
  ['Parliament Watch', ['politics'], 'free', 'nonprofit', 'digital-native'],
  ['Circuit Review', ['tech-science'], 'free', 'private', 'digital-native'],
  ['Lab Notes', ['tech-science'], 'free', 'nonprofit', 'magazine'],
];

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function outletsFor(spec: Spec): Outlet[] {
  const prefix = spec.iso2.toLowerCase();
  const next = new Map<Category, number>();
  const outlets = OUTLETS.map(([name, categories, paywall, ownership, format], index): Outlet => {
    const slug = slugOf(name);
    const ranks: Partial<Record<Category, number>> = {};
    for (const category of categories) {
      const rank = (next.get(category) ?? 0) + 1;
      next.set(category, rank);
      ranks[category] = rank;
    }
    return {
      id: `${prefix}-${slug}`,
      slug,
      name: `${spec.name} ${name}`,
      url: `https://${prefix}-${slug}.example.com/`,
      rss_url: index % 3 === 0 ? `https://${prefix}-${slug}.example.com/feed.xml` : null,
      language: 'en',
      categories,
      primary_category: categories[0] ?? 'general-news',
      ranks,
      region: null,
      founded_year: 1900 + index * 5,
      paywall,
      ownership_type: ownership,
      owner: ownership === 'public-service' ? null : `${name} Media Group`,
      political_lean: { value: 'unrated', source_url: null },
      format,
      editor_pick: index < 2,
      pitch: {
        en: `Fictional ${name.toLowerCase()} used to test the ${spec.name} directory page layout.`,
      },
      about:
        index < 4
          ? {
              en: {
                text: `${spec.name} ${name} is a fictional outlet used only in automated tests.`,
                reviewed: true,
              },
            }
          : {},
      sources: [],
      status: spec.published ? 'verified' : 'candidate',
      verified_at: spec.published ? DATE : null,
      health: {
        last_checked: DATE,
        http_status: 200,
        final_url: `https://${prefix}-${slug}.example.com/`,
      },
    };
  });
  const template = outlets[1];
  if (!spec.published || !template) return outlets;
  return [
    ...outlets,
    {
      ...template,
      id: `${prefix}-unverified-gazette`,
      slug: 'unverified-gazette',
      name: `${spec.name} Unverified Gazette`,
      url: `https://${prefix}-unverified.example.com/`,
      ranks: { 'general-news': 99 },
      categories: ['general-news'],
      primary_category: 'general-news',
      status: 'candidate',
      verified_at: null,
      editor_pick: false,
    },
    {
      ...template,
      id: `${prefix}-closed-times`,
      slug: 'closed-times',
      name: `${spec.name} Closed Times`,
      url: `https://${prefix}-closed.example.com/`,
      ranks: { 'general-news': 98 },
      categories: ['general-news'],
      primary_category: 'general-news',
      status: 'retired',
      editor_pick: false,
    },
  ];
}

function countryFor(spec: Spec): Country {
  const entry = geo.find((g) => g.iso2 === spec.iso2);
  if (!entry) throw new Error(spec.iso2);
  return {
    iso2: spec.iso2,
    iso3: entry.iso3,
    slug: spec.slug,
    name: { en: spec.name },
    continent: entry.continent as Country['continent'],
    also_in: entry.also_in as Country['also_in'],
    population: {
      value: 10_000_000,
      year: 2024,
      source: 'https://data.worldbank.org/indicator/SP.POP.TOTL',
    },
    official_languages: entry.official_languages,
    press_freedom: {
      rank: 10,
      status: 'good',
      year: 2025,
      source: 'RSF World Press Freedom Index',
      source_url: 'https://rsf.org/en/index',
    },
    neighbors: entry.neighbors,
    published: spec.published,
    seo_context: {
      en: {
        summary: `Fictional media landscape summary for ${spec.name}, used only by automated tests of the directory.`,
        faq: [
          {
            q: `What are the main news outlets in ${spec.name}?`,
            a: `The fixture lists ${spec.name} Morning Ledger first.`,
          },
          {
            q: `Which ${spec.name} news sites are free?`,
            a: 'Several fixture outlets are free to read.',
          },
        ],
        categories: {
          'general-news': { intro: `Fixture intro for national news in ${spec.name}.` },
          economy: { intro: `Fixture intro for business news in ${spec.name}.` },
        },
        reviewed: spec.published,
        reviewed_at: spec.published ? DATE : null,
      },
    },
  };
}

rmSync(ROOT, { recursive: true, force: true });
mkdirSync(`${ROOT}/countries`, { recursive: true });
mkdirSync(`${ROOT}/outlets`, { recursive: true });
for (const spec of COUNTRIES) {
  writeJson(`${ROOT}/countries/${spec.iso2.toLowerCase()}.json`, countryFor(spec));
  writeJson(`${ROOT}/outlets/${spec.iso2.toLowerCase()}.json`, outletsFor(spec));
}
console.log(`Fixtures written to ${ROOT}`);
