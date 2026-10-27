import type { APIRoute } from 'astro';
import { isAdmin } from '../../../server/access';
import { EXPORTS, exportRows, toCsv, type ExportType } from '../../../server/admin';
import { filteredClicksSql, queryClicks } from '../../../server/analytics';
import { problem, respond } from '../../../server/http';
import { db, env } from '../../../runtime/worker';

export const prerender = false;

const isExport = (type: string | null): type is ExportType =>
  (EXPORTS as readonly (string | null)[]).includes(type);

/** CSV export: ?type=submissions|sponsorships|corrections|clicks. */
export const GET: APIRoute = ({ request, url }) =>
  respond(async () => {
    if (!(await isAdmin(request, env))) return problem(403, 'Forbidden.');
    const type = url.searchParams.get('type');
    let rows: Record<string, unknown>[];
    if (type === 'clicks') {
      rows =
        (await queryClicks(
          env.CLOUDFLARE_ACCOUNT_ID,
          env.CLOUDFLARE_ANALYTICS_TOKEN,
          filteredClicksSql('newsmap_clicks', 30, 'blob1'),
        )) ?? [];
    } else if (isExport(type)) {
      rows = await exportRows(db(), type);
    } else {
      return problem(400, 'Unknown export.');
    }
    return new Response(toCsv(rows), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="newsmap-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
        'cache-control': 'no-store',
      },
    });
  });
