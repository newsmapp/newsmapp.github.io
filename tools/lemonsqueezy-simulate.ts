/**
 * Sends signed LemonSqueezy test events to a local Worker, for simulation mode.
 *
 *   pnpm lemonsqueezy:simulate <event> <submission-id> [--url http://localhost:8787]
 *
 * Events: subscription_created, subscription_payment_success, subscription_payment_failed,
 * subscription_cancelled, subscription_expired, order_refunded. The signing secret is read
 * from LEMONSQUEEZY_WEBHOOK_SECRET in the environment or .dev.vars; it never leaves this machine.
 */
import { existsSync, readFileSync } from 'node:fs';
import { hmacSha256, toHex } from '../src/server/crypto';

const EVENTS = [
  'subscription_created',
  'subscription_payment_success',
  'subscription_payment_failed',
  'subscription_cancelled',
  'subscription_expired',
  'order_refunded',
] as const;
type EventName = (typeof EVENTS)[number];

function secret(): string {
  if (process.env.LEMONSQUEEZY_WEBHOOK_SECRET) return process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (existsSync('.dev.vars')) {
    const line = readFileSync('.dev.vars', 'utf8')
      .split('\n')
      .find((l) => l.startsWith('LEMONSQUEEZY_WEBHOOK_SECRET='));
    if (line) return line.slice(line.indexOf('=') + 1).trim();
  }
  throw new Error('Set LEMONSQUEEZY_WEBHOOK_SECRET or add it to .dev.vars');
}

/** Test ids derived from the submission, so later events find what subscription_created stored. */
/**
 * A signed-shape LemonSqueezy event. Pass the variant id once pricing.json has real ones:
 * a subscription_created for the wrong variant (or none) is refunded as an unwanted payment.
 */
export function testEvent(
  name: EventName,
  submissionId: string,
  now = new Date(),
  variantId?: string,
) {
  const suffix = submissionId.replace(/[^0-9a-f]/g, '').slice(0, 8) || '1';
  const subscriptionId = `90${parseInt(suffix, 16) % 1_000_000}`;
  const orderId = `80${parseInt(suffix, 16) % 1_000_000}`;
  const endsAt = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  if (name === 'order_refunded') {
    return {
      meta: { event_name: name, custom_data: { submission_id: submissionId } },
      data: {
        type: 'orders',
        id: orderId,
        attributes: { status: 'refunded', updated_at: now.toISOString() },
      },
    };
  }
  const status = {
    subscription_created: 'active',
    subscription_payment_success: 'active',
    subscription_payment_failed: 'past_due',
    subscription_cancelled: 'cancelled',
    subscription_expired: 'expired',
  }[name];
  return {
    meta: { event_name: name, custom_data: { submission_id: submissionId } },
    data: {
      type: 'subscriptions',
      id: subscriptionId,
      attributes: {
        status,
        order_id: Number(orderId),
        ...(variantId ? { variant_id: Number(variantId) } : {}),
        updated_at: now.toISOString(),
        ends_at: name === 'subscription_cancelled' ? endsAt : null,
        renews_at: endsAt,
      },
    },
  };
}

async function main() {
  const [name, submissionId] = process.argv.slice(2);
  const urlFlag = process.argv.indexOf('--url');
  const base = urlFlag > 0 ? process.argv[urlFlag + 1] : 'http://localhost:8787';
  const variantFlag = process.argv.indexOf('--variant');
  const variantId = variantFlag > 0 ? process.argv[variantFlag + 1] : undefined;
  if (!name || !EVENTS.includes(name as EventName) || !submissionId) {
    console.error(
      `Usage: pnpm lemonsqueezy:simulate <${EVENTS.join('|')}> <submission-id> [--url URL] [--variant ID]`,
    );
    process.exit(2);
  }
  const body = JSON.stringify(testEvent(name as EventName, submissionId, new Date(), variantId));
  const response = await fetch(`${base}/api/webhooks/lemonsqueezy/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-event-name': name,
      'x-signature': toHex(await hmacSha256(secret(), body)),
    },
    body,
  });
  console.log(response.status, await response.text());
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
