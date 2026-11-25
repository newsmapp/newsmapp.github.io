/**
 * Runs after `astro build`: removes from dist/icons/ every icon the published catalog does not use.
 * public/icons/ also holds icons of candidate outlets (fetched while drafting) and leftovers of
 * removed or fixture outlets; none of them may be deployed, or unpublished entries would be
 * reachable at /icons/<id>.webp.
 *
 *   tsx tools/prune-icons.ts [dist]
 */
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { PublicCatalog } from '../src/lib/catalog/public';

const dist = process.argv[2] ?? 'dist';
const dir = join(dist, 'icons');
const catalog = JSON.parse(readFileSync('src/generated/catalog.json', 'utf8')) as PublicCatalog;
const keep = new Set(catalog.countries.flatMap((c) => c.outlets.map((o) => basename(o.icon))));

let removed = 0;
if (existsSync(dir)) {
  for (const name of readdirSync(dir)) {
    if (keep.has(name)) continue;
    rmSync(join(dir, name));
    removed += 1;
  }
}
console.log(`Icons: ${keep.size} deployed, ${removed} unpublished removed from ${dir}/`);
