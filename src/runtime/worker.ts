/**
 * Request-time wiring for on-demand routes: bindings, secrets and configured services.
 * The only module besides src/worker.ts that touches the Workers runtime; logic lives in src/server.
 */
import { env, waitUntil } from 'cloudflare:workers';
import affiliatesJson from '../../data/monetization/affiliates.json';
import pricingJson from '../../data/monetization/pricing.json';
import runtimeCatalogJson from '../generated/runtime-catalog.json';
import { outletHostIndex, type RuntimeCatalog } from '../lib/catalog/public';
import { affiliatesFileSchema, pricingFileSchema } from '../schemas/monetization.schema';
import { visitorHash } from '../server/analytics';
import { database } from '../server/db';
import { clientIp } from '../server/http';
import type { LemonSqueezyConfig } from '../server/lemonsqueezy';
import { verifyTurnstile } from '../server/turnstile';

export { env, waitUntil };

export const catalog = runtimeCatalogJson as RuntimeCatalog;
export const outletsByHost = outletHostIndex(catalog);
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

/**
 * Daily keyed hash of the client IP and User-Agent, the same kind of code as the click hash;
 * null when the IP is unknown. The browser is part of it so that people sharing one IP rarely
 * count as one visitor. The daily key means a cap can restart at midnight UTC, which at most
 * doubles it for that night.
 */
export async function holder(request: Request): Promise<string | null> {
  const ip = clientIp(request);
  if (!ip) return null;
  const userAgent = request.headers.get('user-agent') ?? '';
  const day = new Date().toISOString().slice(0, 10);
  return visitorHash(env.VISITOR_HASH_SECRET, day, ip, `hold\n${userAgent}`);
}

/** True when the caller exceeded the limiter (per client IP). */
export async function overLimit(
  limiter: RateLimit | undefined,
  request: Request,
): Promise<boolean> {
  if (!limiter) return false;
  const { success } = await limiter.limit({ key: clientIp(request) || 'unknown' });
  return !success;
}
