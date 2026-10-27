import { z } from 'zod';
import { CONTINENTS, httpsUrl, iso2, iso3, isoDate, localized, slug, text } from './common';

export const CATEGORIES = [
  'general-news',
  'politics',
  'sports',
  'economy',
  'investigative',
  'tech-science',
  'broadcast',
  'regional',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  'general-news': 'Top National News',
  politics: 'Politics & Government',
  sports: 'Sports',
  economy: 'Business, Finance & Markets',
  investigative: 'Investigative & Fact-Checking',
  'tech-science': 'Tech, Science & Culture',
  broadcast: 'TV & Radio News',
  regional: 'Regional & Local',
};

/** Path segments that can never be a category or country slug. */
export const RESERVED_SEGMENTS = [
  'outlet',
  'continent',
  'api',
  'go',
  'badge',
  'admin',
  'about',
  'methodology',
  'corrections',
  'disclosures',
  'privacy',
  'terms',
  'advertise',
  'pagefind',
  'icons',
  'flags',
] as const;

export const PAYWALLS = ['free', 'metered', 'freemium', 'hard'] as const;
export type Paywall = (typeof PAYWALLS)[number];

export const OWNERSHIP_TYPES = [
  'private',
  'public-service',
  'state-controlled',
  'nonprofit',
  'cooperative',
  'unknown',
] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

export const POLITICAL_LEANS = [
  'left',
  'center-left',
  'center',
  'center-right',
  'right',
  'mixed',
  'unrated',
] as const;

export const FORMATS = [
  'newspaper',
  'digital-native',
  'broadcaster-tv',
  'broadcaster-radio',
  'magazine',
  'agency',
] as const;
export type Format = (typeof FORMATS)[number];

export const OUTLET_STATUSES = ['candidate', 'verified', 'retired'] as const;

export const PRESS_FREEDOM_STATUSES = [
  'good',
  'satisfactory',
  'problematic',
  'difficult',
  'very-serious',
] as const;

const faqItem = z.strictObject({ q: text, a: text });

const seoContextSchema = z.strictObject({
  summary: text,
  faq: z.array(faqItem).min(1),
  categories: z.partialRecord(z.enum(CATEGORIES), z.strictObject({ intro: text })),
  reviewed: z.boolean(),
  reviewed_at: isoDate.nullable(),
});

export const countrySchema = z.strictObject({
  iso2,
  iso3,
  slug,
  name: localized(text),
  continent: z.enum(CONTINENTS),
  also_in: z.array(z.enum(CONTINENTS)),
  population: z.strictObject({
    value: z.number().int().positive(),
    year: z.number().int().min(1990),
    source: httpsUrl,
  }),
  official_languages: z.array(z.string().regex(/^[a-z]{2,3}$/)).min(1),
  press_freedom: z
    .strictObject({
      rank: z.number().int().positive(),
      status: z.enum(PRESS_FREEDOM_STATUSES),
      year: z.number().int().min(2002),
      source: text,
      source_url: httpsUrl,
    })
    .nullable(),
  neighbors: z.array(iso2),
  published: z.boolean(),
  seo_context: localized(seoContextSchema),
});

const sourceSchema = z.strictObject({ field: text, url: httpsUrl });

export const outletSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be "<iso2>-<slug>"'),
    slug,
    name: text,
    url: httpsUrl,
    rss_url: httpsUrl.nullable(),
    language: z.string().regex(/^[a-z]{2,3}$/),
    categories: z.array(z.enum(CATEGORIES)).min(1),
    primary_category: z.enum(CATEGORIES),
    ranks: z.partialRecord(z.enum(CATEGORIES), z.number().int().min(1)),
    region: text.nullable(),
    founded_year: z.number().int().min(1600).max(2100).nullable(),
    paywall: z.enum(PAYWALLS),
    ownership_type: z.enum(OWNERSHIP_TYPES),
    owner: text.nullable(),
    political_lean: z.strictObject({
      value: z.enum(POLITICAL_LEANS),
      source_url: httpsUrl.nullable(),
    }),
    format: z.enum(FORMATS),
    editor_pick: z.boolean(),
    pitch: localized(text),
    about: localized(z.strictObject({ text, reviewed: z.boolean() })),
    sources: z.array(sourceSchema),
    status: z.enum(OUTLET_STATUSES),
    verified_at: isoDate.nullable(),
    health: z
      .strictObject({
        last_checked: isoDate,
        http_status: z.number().int().nullable(),
        final_url: httpsUrl.nullable(),
        title: text.nullable().optional(),
      })
      .nullable(),
  })
  .superRefine((outlet, ctx) => {
    if (!outlet.id.endsWith(`-${outlet.slug}`)) {
      ctx.addIssue({ code: 'custom', path: ['id'], message: 'id must end with "-<slug>"' });
    }
    if (!outlet.categories.includes(outlet.primary_category)) {
      ctx.addIssue({
        code: 'custom',
        path: ['primary_category'],
        message: 'primary_category must be one of categories',
      });
    }
    if (new Set(outlet.categories).size !== outlet.categories.length) {
      ctx.addIssue({ code: 'custom', path: ['categories'], message: 'duplicate category' });
    }
    const rankKeys = Object.keys(outlet.ranks).sort();
    if (rankKeys.join() !== [...outlet.categories].sort().join()) {
      ctx.addIssue({
        code: 'custom',
        path: ['ranks'],
        message: 'ranks must have exactly one key per category',
      });
    }
    if (outlet.categories.includes('regional') && outlet.region === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['region'],
        message: 'region is required for regional outlets',
      });
    }
    if (
      outlet.ownership_type === 'state-controlled' &&
      !outlet.sources.some((source) => source.field === 'ownership_type')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['sources'],
        message: 'state-controlled requires a source for ownership_type',
      });
    }
    if (outlet.political_lean.value !== 'unrated' && outlet.political_lean.source_url === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['political_lean', 'source_url'],
        message: 'a political lean other than "unrated" requires a source_url',
      });
    }
    if (outlet.status === 'verified' && outlet.verified_at === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['verified_at'],
        message: 'verified outlets need verified_at',
      });
    }
  });

export const outletsFileSchema = z.array(outletSchema);

export type Country = z.infer<typeof countrySchema>;
export type Outlet = z.infer<typeof outletSchema>;
export type SeoContext = z.infer<typeof seoContextSchema>;
