import type { APIRoute } from 'astro';
import { botBucket, clickDataPoint, visitorHash } from '../../server/analytics';
import { clientIp, problem, respond, visitorCountry } from '../../server/http';
import { GO_ID, redirect, resolveStatic, sponsoredTarget } from '../../server/go';
import { liveSponsorship } from '../../server/sponsorships';
import { affiliates, catalog, db, env, waitUntil } from '../../runtime/worker';

export const prerender = false;

/** Sponsored and affiliate redirects (ADR 0006): allowlisted ids only, click recorded on the way. */
export const GET: APIRoute = ({ params, request }) =>
  respond(async () => {
    const id = params.id ?? '';
    if (!GO_ID.test(id)) return problem(404, 'Unknown link.');
    let target = resolveStatic(id, catalog, affiliates);
    if (!target && id.startsWith('sp-')) {
      const row = await liveSponsorship(db(), id);
      if (row) target = sponsoredTarget(row);
    }
    if (!target) return problem(404, 'Unknown link.');
    const userAgent = request.headers.get('user-agent') ?? '';
    const day = new Date().toISOString().slice(0, 10);
    const found = target;
    waitUntil(
      visitorHash(env.VISITOR_HASH_SECRET, day, clientIp(request), userAgent).then((visitor) =>
        env.CLICKS.writeDataPoint(
          clickDataPoint({
            outletId: found.outletId,
            country: found.country,
            category: found.category,
            visitorCountry: visitorCountry(request),
            sponsored: found.sponsored,
            source: 'go',
            bot: botBucket(userAgent),
            visitor,
          }),
        ),
      ),
    );
    return redirect(target.url);
  });
