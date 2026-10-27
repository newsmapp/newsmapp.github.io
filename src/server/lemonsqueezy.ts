import { hmacSha256, timingSafeEqual, toHex } from './crypto';

/** LemonSqueezy API client (merchant of record for sponsorships). JSON:API over HTTPS. */
const API = 'https://api.lemonsqueezy.com/v1';

export interface LemonSqueezyConfig {
  apiKey: string;
  storeId: string;
  fetcher?: typeof fetch;
}

const headers = (apiKey: string) => ({
  accept: 'application/vnd.api+json',
  'content-type': 'application/vnd.api+json',
  authorization: `Bearer ${apiKey}`,
});

/** X-Signature is the hex HMAC-SHA256 of the raw request body with the webhook secret. */
export async function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;
  return timingSafeEqual(toHex(await hmacSha256(secret, rawBody)), signature.trim().toLowerCase());
}

export interface CheckoutRequest {
  variantId: string;
  email: string;
  submissionId: string;
  redirectUrl: string;
  expiresAt: string;
}

/** Creates a hosted checkout and returns its URL. */
export async function createCheckout(
  config: LemonSqueezyConfig,
  request: CheckoutRequest,
): Promise<string> {
  const response = await (config.fetcher ?? fetch)(`${API}/checkouts`, {
    method: 'POST',
    headers: headers(config.apiKey),
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: { email: request.email, custom: { submission_id: request.submissionId } },
          product_options: { redirect_url: request.redirectUrl },
          expires_at: request.expiresAt,
        },
        relationships: {
          store: { data: { type: 'stores', id: config.storeId } },
          variant: { data: { type: 'variants', id: request.variantId } },
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`LemonSqueezy checkout failed: HTTP ${response.status}`);
  const body = (await response.json()) as { data?: { attributes?: { url?: string } } };
  const url = body.data?.attributes?.url;
  if (!url) throw new Error('LemonSqueezy checkout response had no URL');
  return url;
}

/** Full refund of an order (editor rejected the listing). */
export async function refundOrder(config: LemonSqueezyConfig, orderId: string): Promise<boolean> {
  const response = await (config.fetcher ?? fetch)(
    `${API}/orders/${encodeURIComponent(orderId)}/refund`,
    {
      method: 'POST',
      headers: headers(config.apiKey),
      body: JSON.stringify({ data: { type: 'orders', id: orderId, attributes: {} } }),
    },
  );
  return response.ok;
}

/** Cancels a subscription so it does not renew. */
export async function cancelSubscription(
  config: LemonSqueezyConfig,
  subscriptionId: string,
): Promise<boolean> {
  const response = await (config.fetcher ?? fetch)(
    `${API}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: 'DELETE',
      headers: headers(config.apiKey),
    },
  );
  return response.ok;
}

export interface WebhookEvent {
  meta: { event_name: string; test_mode?: boolean; custom_data?: { submission_id?: string } };
  data: {
    type: string;
    id: string;
    attributes: {
      updated_at?: string;
      status?: string;
      order_id?: number | string;
      ends_at?: string | null;
      renews_at?: string | null;
      subscription_id?: number | string;
    };
  };
}

export function parseEvent(raw: string): WebhookEvent | null {
  try {
    const event = JSON.parse(raw) as Partial<WebhookEvent>;
    if (typeof event.meta?.event_name !== 'string' || typeof event.data?.id !== 'string')
      return null;
    return {
      ...event,
      data: { ...event.data, attributes: event.data.attributes ?? {} },
    } as WebhookEvent;
  } catch {
    return null;
  }
}

/** Test-mode purchases never change listings unless the owner opted in (store still in test mode). */
export const acceptsEvent = (event: WebhookEvent, acceptTestEvents: boolean): boolean =>
  event.meta.test_mode !== true || acceptTestEvents;

export const idempotencyKey = (event: WebhookEvent): string =>
  `${event.meta.event_name}:${event.data.id}:${event.data.attributes.updated_at ?? ''}`;
