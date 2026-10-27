/**
 * Request-time wiring for on-demand routes: bindings, secrets and configured services.
 * The only module besides src/worker.ts that touches the Workers runtime; logic lives in src/server.
 */
import { env, waitUntil } from 'cloudflare:workers';
import affiliatesJson from '../../data/monetization/affiliates.json';
import pricingJson from '../../data/monetization/pricing.json';
import runtimeCatalogJson from '../generated/runtime-catalog.json';
import type { RuntimeCatalog } from '../lib/catalog/public';
import { affiliatesFileSchema, pricingFileSchema } from '../schemas/monetization.schema';
import { database } from '../server/db';
import { clientIp } from '../server/http';
import type { LemonSqueezyConfig } from '../server/lemonsqueezy';
import { verifyTurnstile } from '../server/turnstile';

export { env, waitUntil };

export const catalog = runtimeCatalogJson as RuntimeCatalog;
export const affiliates = affiliatesFileSchema.parse(affiliatesJson);
export const pricing = pricingFileSchema.parse(pricingJson);

export const db = () => database(env.DB);

/** Null means simulation mode (no LemonSqueezy keys configured). */
export const lemonSqueezy = (): LemonSqueezyConfig | null =>
  env.LEMONSQUEEZY_API_KEY && env.LEMONSQUEEZY_STORE_ID
    ? { apiKey: env.LEMONSQUEEZY_API_KEY, storeId: env.LEMONSQUEEZY_STORE_ID }
    : null;

export const human = (request: Request) => (token: string) =>
  verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, clientIp(request));

/** True when the caller exceeded the limiter (per client IP). */
export async function overLimit(
  limiter: RateLimit | undefined,
  request: Request,
): Promise<boolean> {
  if (!limiter) return false;
  const { success } = await limiter.limit({ key: clientIp(request) || 'unknown' });
  return !success;
}
