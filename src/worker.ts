import { handle } from '@astrojs/cloudflare/handler';
import { runDailyMaintenance } from './server/maintenance';

export default {
  fetch: handle,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runDailyMaintenance(env));
  },
} satisfies ExportedHandler<Env>;
