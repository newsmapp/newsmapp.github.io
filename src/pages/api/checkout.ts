import type { APIRoute } from 'astro';
import { startCheckout } from '../../server/forms';
import { problem, readJson, respond } from '../../server/http';
import {
  db,
  env,
  holder,
  human,
  lemonSqueezy,
  outletsByHost,
  overLimit,
  pricing,
} from '../../runtime/worker';

export const prerender = false;

export const POST: APIRoute = ({ request }) =>
  respond(async () => {
    if (await overLimit(env.FORM_LIMITER, request))
      return problem(429, 'Too many requests. Try again in a minute.');
    return startCheckout(await readJson(request), {
      db: db(),
      now: new Date(),
      siteUrl: new URL(request.url).origin,
      human: human(request),
      outletsByHost,
      holder: await holder(request),
      pricing,
      lemonSqueezy: lemonSqueezy(),
    });
  });
