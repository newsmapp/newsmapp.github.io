import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogInput, RawFile } from '@/lib/catalog/validate';

const readDir = (root: string, dir: string): RawFile[] =>
  readdirSync(join(root, dir))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({
      file: `${dir}/${name}`,
      data: JSON.parse(readFileSync(join(root, dir, name), 'utf8')) as unknown,
    }));

/** Loads a catalog directory the same way the CLI does. */
export function loadInput(root: string): CatalogInput {
  return {
    geo: JSON.parse(readFileSync('data/geo/countries.json', 'utf8')) as unknown,
    countries: readDir(root, 'countries'),
    outlets: readDir(root, 'outlets'),
    locales: ['en'],
  };
}

export const FIXTURES = 'tests/fixtures/catalog';

/** Deep copy so tests can mutate input safely. */
export const clone = <T>(value: T): T => structuredClone(value);
