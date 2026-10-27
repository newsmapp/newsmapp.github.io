import type { APIRoute } from 'astro';
import { json, problem, readText, respond } from '../../../server/http';
import { acceptsEvent, parseEvent, verifySignature } from '../../../server/lemonsqueezy';
import { dispatchRebuild } from '../../../server/rebuild';
import { applyEvent, settleUnwanted } from '../../../server/webhooks';
import { db, env, lemonSqueezy, pricing, waitUntil } from '../../../runtime/worker';

export const prerender = false;

const MAX_WEBHOOK_BYTES = 256 * 1024;

/** Signed with HMAC-SHA256 over the raw body; replays are absorbed by webhook_events. */
export const POST: APIRoute = ({ request }) =>
  respond(async () => {
    const raw = await readText(request, MAX_WEBHOOK_BYTES);
    if (
      !(await verifySignature(
        raw,
        request.headers.get('x-signature'),
        env.LEMONSQUEEZY_WEBHOOK_SECRET,
      ))
    ) {
      return problem(401, 'Invalid signature.');
    }
    const event = parseEvent(raw);
    if (!event) return problem(400, 'Unreadable event.');
    // Answered 200 so LemonSqueezy does not retry an event we will never apply.
    if (!acceptsEvent(event, env.LEMONSQUEEZY_ACCEPT_TEST_EVENTS === 'true'))
      return json({ status: 'ignored', rebuild: false });
    const now = new Date();
    const { unwanted, ...outcome } = await applyEvent(db(), event, now, pricing);
    const config = lemonSqueezy();
    if (unwanted && config) waitUntil(settleUnwanted(db(), config, unwanted, now));
    if (outcome.rebuild) waitUntil(dispatchRebuild(env, `webhook ${event.meta.event_name}`));
    return json(outcome);
  });
