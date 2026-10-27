import type { APIRoute } from 'astro';
import { submitCorrection } from '../../server/forms';
import { problem, readJson, respond } from '../../server/http';
import { catalog, db, env, human, overLimit } from '../../runtime/worker';

export const prerender = false;

export const POST: APIRoute = ({ request }) =>
  respond(async () => {
    if (await overLimit(env.FORM_LIMITER, request))
      return problem(429, 'Too many requests. Try again in a minute.');
    return submitCorrection(await readJson(request), {
      db: db(),
      now: new Date(),
      siteUrl: new URL(request.url).origin,
      human: human(request),
      catalog,
    });
  });
