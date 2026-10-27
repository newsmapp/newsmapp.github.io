import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Outlet } from '../../src/schemas/catalog.schema';
import { LOCALES, type Locale } from '../../src/schemas/common';
import type { CatalogInput, RawFile } from '../../src/lib/catalog/validate';

/** Catalog root. Tests and E2E point CATALOG_DIR at a fixtures catalog. */
export const catalogDir = resolve(process.env.CATALOG_DIR ?? 'data');

export function enabledLocales(): Locale[] {
  const raw = (process.env.ENABLED_LOCALES ?? 'en').split(',').map((l) => l.trim());
  const invalid = raw.filter((l) => !(LOCALES as readonly string[]).includes(l));
  if (invalid.length > 0)
    throw new Error(`Unknown locale(s) in ENABLED_LOCALES: ${invalid.join()}`);
  return raw as Locale[];
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

function readDir(dir: string): RawFile[] {
  const full = join(catalogDir, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({ file: `${dir}/${name}`, data: readJson(join(full, name)) }));
}

export function loadCatalogInput(): CatalogInput {
  const geoPath = join(catalogDir, 'geo/countries.json');
  // Fixture catalogs reuse the real geo table.
  const geo = readJson(existsSync(geoPath) ? geoPath : resolve('data/geo/countries.json'));
  return {
    geo,
    countries: readDir('countries'),
    outlets: readDir('outlets'),
    locales: enabledLocales(),
  };
}

export const outletsPath = (iso2: string): string =>
  join(catalogDir, 'outlets', `${iso2.toLowerCase()}.json`);

export function readOutlets(iso2: string): Outlet[] {
  const path = outletsPath(iso2);
  return existsSync(path) ? (readJson(path) as Outlet[]) : [];
}

export function writeJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

/** Minimal `--flag value` / `--flag` parser. */
export function parseFlags(args: string[]): { positional: string[]; flags: Map<string, string> } {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? '';
    if (arg.startsWith('--')) {
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags.set(arg.slice(2), next);
        i += 1;
      } else flags.set(arg.slice(2), 'true');
    } else positional.push(arg);
  }
  return { positional, flags };
}

export const today = (): string => new Date().toISOString().slice(0, 10);
