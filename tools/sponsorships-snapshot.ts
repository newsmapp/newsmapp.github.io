/**
 * Exports listed sponsorships from D1 to src/generated/sponsorships.json for the static build.
 *
 *   pnpm sponsorships:snapshot             remote D1 via the API (CI), falls back to empty
 *   pnpm sponsorships:snapshot --required  same, but fails without credentials (deploy workflow)
 *   pnpm sponsorships:snapshot --local     the local D1 used by wrangler dev
 *
 * Remote mode needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_D1_READ_TOKEN (D1 read only) and reads
 * the database id from wrangler.jsonc.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { SNAPSHOT_SQL, toSnapshot, type SponsorshipRow } from '../src/lib/monetization/snapshot';
import { ICONS_DIR } from './catalog-cli/icons';
import { writeJson } from './catalog-cli/io';

const OUTPUT = 'src/generated/sponsorships.json';

export function databaseId(wranglerConfig: string): string | null {
  return /"database_id"\s*:\s*"([0-9a-f-]{36})"/.exec(wranglerConfig)?.[1] ?? null;
}

async function remoteRows(): Promise<SponsorshipRow[] | null> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_D1_READ_TOKEN;
  const id = databaseId(readFileSync('wrangler.jsonc', 'utf8'));
  if (!account || !token || !id || /^0{8}-/.test(id)) return null;
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${id}/query`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sql: SNAPSHOT_SQL }),
    },
  );
  const body = (await response.json()) as {
    success?: boolean;
    result?: { results?: SponsorshipRow[] }[];
  };
  if (!response.ok || !body.success) throw new Error(`D1 query failed: HTTP ${response.status}`);
  return body.result?.[0]?.results ?? [];
}

function localRows(): SponsorshipRow[] {
  const output = execFileSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'execute',
      'newsmap',
      '--local',
      '--json',
      '--command',
      SNAPSHOT_SQL,
    ],
    { encoding: 'utf8' },
  );
  return (JSON.parse(output) as { results: SponsorshipRow[] }[])[0]?.results ?? [];
}

const iconFor = (outletId: string): string =>
  existsSync(`${ICONS_DIR}/${outletId}.webp`)
    ? `/icons/${outletId}.webp`
    : `/icons/${outletId}.svg`;

async function main() {
  const args = new Set(process.argv.slice(2));
  const rows = args.has('--local') ? localRows() : await remoteRows();
  if (rows === null) {
    if (args.has('--required')) {
      console.error(
        'Missing CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_READ_TOKEN or the D1 database id.',
      );
      process.exit(1);
    }
    console.warn('No D1 credentials: writing an empty sponsorship snapshot.');
  }
  const snapshot = toSnapshot(rows ?? [], iconFor);
  writeJson(OUTPUT, snapshot);
  console.log(`Sponsorship snapshot: ${snapshot.length} listed slot(s) → ${OUTPUT}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
