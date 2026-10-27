import type { APIRoute } from 'astro';
import { isAdmin } from '../../../server/access';
import { runAction, type AdminAction } from '../../../server/admin';
import { problem, respond, sameOrigin } from '../../../server/http';
import { dispatchRebuild } from '../../../server/rebuild';
import { db, env, lemonSqueezy, waitUntil } from '../../../runtime/worker';

export const prerender = false;

const ACTIONS = new Set<AdminAction>([
  'approve',
  'reject',
  'close-suggestion',
  'accept-correction',
  'reject-correction',
]);

/** Editor decisions from /admin/. POST only, same origin only, Access JWT required. */
export const POST: APIRoute = ({ params, request }) =>
  respond(async () => {
    if (!(await isAdmin(request, env))) return problem(403, 'Forbidden.');
    if (!sameOrigin(request)) return problem(403, 'Cross-origin request refused.');
    const action = params.action as AdminAction;
    if (!ACTIONS.has(action)) return problem(404, 'Unknown action.');
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!/^[a-z]{2,3}-[0-9a-f-]{36}$/.test(id)) return problem(400, 'Invalid id.');
    const result = await runAction(db(), action, id, new Date(), lemonSqueezy());
    if (result.rebuild) waitUntil(dispatchRebuild(env, `admin ${action}`));
    const back = new URL('/admin/', request.url);
    back.searchParams.set(result.ok ? 'done' : 'error', result.message);
    return Response.redirect(back.toString(), 303);
  });
