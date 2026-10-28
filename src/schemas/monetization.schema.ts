import { z } from 'zod';
import { CATEGORIES, PAYWALLS } from './catalog.schema';
import { LOCALES, httpsUrl, iso2, slug, text } from './common';

export const AFFILIATE_CONTEXTS = ['vpn-travel', 'vpn-privacy', 'finance', 'paid-news'] as const;
export type AffiliateContext = (typeof AFFILIATE_CONTEXTS)[number];

export const affiliateSchema = z.strictObject({
  id: slug,
  name: text,
  context: z.enum(AFFILIATE_CONTEXTS),
  url: httpsUrl,
  /** Query parameters appended on redirect (affiliate id, UTM). Values are public. */
  params: z.record(z.string(), z.string()),
  headline: text,
  body: text,
  cta: text,
  /** The copy in other languages; English above is the fallback. */
  translations: z
    .partialRecord(z.enum(LOCALES), z.strictObject({ headline: text, body: text, cta: text }))
    .optional(),
  active: z.boolean(),
});

export const affiliatesFileSchema = z.strictObject({
  affiliates: z.array(affiliateSchema),
  rules: z.strictObject({
    by_category: z.partialRecord(z.enum(CATEGORIES), z.enum(AFFILIATE_CONTEXTS)),
    by_paywall: z.partialRecord(z.enum(PAYWALLS), z.enum(AFFILIATE_CONTEXTS)),
  }),
});

export const PLANS = ['monthly', 'yearly'] as const;
export type Plan = (typeof PLANS)[number];

export const pricingFileSchema = z.strictObject({
  currency: z.literal('USD'),
  default_tier: z.number().int().min(1),
  tiers: z.array(
    z.strictObject({
      tier: z.number().int().min(1),
      countries: z.array(iso2),
      monthly: z.number().positive(),
      yearly: z.number().positive(),
      variant_ids: z.strictObject({ monthly: z.string(), yearly: z.string() }),
    }),
  ),
  slots_per_category: z.number().int().min(1).max(5),
});

export const vpnRestrictedFileSchema = z.strictObject({
  note: text,
  countries: z.array(iso2),
});

// Runtime payloads (validated in API routes).

const email = z.email().max(254);

export const submitPayloadSchema = z.strictObject({
  outlet_name: text.max(120),
  url: httpsUrl,
  country_iso: iso2,
  category: z.enum(CATEGORIES),
  contact_email: email,
  note: z.string().trim().max(1000).optional(),
  turnstile_token: z.string().min(1).max(4096),
});

export const checkoutPayloadSchema = submitPayloadSchema.extend({
  plan: z.enum(PLANS),
});

export const correctionPayloadSchema = z.strictObject({
  outlet_id: z.string().max(120),
  field: text.max(60),
  message: text.max(2000),
  contact_email: email.optional(),
  turnstile_token: z.string().min(1).max(4096),
});

export const trackPayloadSchema = z.strictObject({
  outlet_id: z.string().max(120),
  country: iso2,
  category: z.enum(CATEGORIES),
});

export type Affiliate = z.infer<typeof affiliateSchema>;
export type AffiliatesFile = z.infer<typeof affiliatesFileSchema>;
export type PricingFile = z.infer<typeof pricingFileSchema>;
