import type { APIRoute } from 'astro';
import { json, problem, respond } from '../../../server/http';
import { parseEvent, verifySignature } from '../../../server/lemonsqueezy';
import { dispatchRebuild } from '../../../server/rebuild';
import { applyEvent } from '../../../server/webhooks';
import { db, env, waitUntil } from '../../../runtime/worker';

export const prerender = false;

const MAX_WEBHOOK_BYTES = 256 * 1024;

/** Signed with HMAC-SHA256 over the raw body; replays are absorbed by webhook_events. */
export const POST: APIRoute = ({ request }) =>
  respond(async () => {
    if (Number(request.headers.get('content-length') ?? 0) > MAX_WEBHOOK_BYTES)
      return problem(413, 'Too large.');
    const raw = await request.text();
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
    const outcome = await applyEvent(db(), event, new Date());
    if (outcome.rebuild) waitUntil(dispatchRebuild(env, `webhook ${event.meta.event_name}`));
    return json(outcome);
  });
