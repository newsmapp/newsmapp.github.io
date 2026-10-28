import type { APIRoute } from 'astro';
import { startCheckout } from '../../server/forms';
import { problem, readJson, respond } from '../../server/http';
import { MESSAGES, requestLang } from '../../server/messages';
import {
  db,
  env,
  holder,
  human,
  lemonSqueezy,
  outletsByHost,
  overLimit,
  pricing,
  publishedCountries,
} from '../../runtime/worker';

export const prerender = false;

export const POST: APIRoute = ({ request }) => {
  const lang = requestLang(request);
  return respond(async () => {
    if (await overLimit(env.FORM_LIMITER, request)) return problem(429, MESSAGES[lang].tooMany);
    return startCheckout(await readJson(request, undefined, lang), {
      lang,
      db: db(),
      now: new Date(),
      siteUrl: new URL(request.url).origin,
      human: human(request),
      outletsByHost,
      countries: publishedCountries,
      holder: await holder(request),
      pricing,
      lemonSqueezy: lemonSqueezy(),
    });
  }, lang);
};
