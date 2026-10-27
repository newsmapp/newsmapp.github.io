import type { APIRoute } from 'astro';
import { trackPayloadSchema } from '../../schemas/monetization.schema';
import { botBucket, clickDataPoint, visitorHash } from '../../server/analytics';
import { clientIp, problem, readJson, respond, visitorCountry } from '../../server/http';
import { catalog, env, overLimit } from '../../runtime/worker';

export const prerender = false;

/** Organic click beacon (H1). Answers 204 whatever happens, except for malformed input. */
export const POST: APIRoute = ({ request }) =>
  respond(async () => {
    if (await overLimit(env.CLICK_LIMITER, request)) return new Response(null, { status: 204 });
    const parsed = trackPayloadSchema.safeParse(await readJson(request, 1024));
    // The outlet must exist and belong to the country sent, so reports cannot be skewed with
    // made-up pairs.
    if (
      !parsed.success ||
      !Object.hasOwn(catalog, parsed.data.outlet_id) ||
      catalog[parsed.data.outlet_id]?.country !== parsed.data.country
    )
      return problem(400, 'Invalid click.');
    const userAgent = request.headers.get('user-agent') ?? '';
    const day = new Date().toISOString().slice(0, 10);
    env.CLICKS.writeDataPoint(
      clickDataPoint({
        outletId: parsed.data.outlet_id,
        country: parsed.data.country,
        category: parsed.data.category,
        visitorCountry: visitorCountry(request),
        sponsored: false,
        source: 'beacon',
        bot: botBucket(userAgent),
        visitor: await visitorHash(env.VISITOR_HASH_SECRET, day, clientIp(request), userAgent),
      }),
    );
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  });
