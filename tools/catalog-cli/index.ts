/**
 * Catalog pipeline (SPEC §3.4). Drafts are always `candidate`; only the owner sets `verified`.
 * Usage: pnpm catalog:<command> [flags]
 */
import { readFileSync } from 'node:fs';
import { parseCsvRecords } from '../../src/lib/csv';
import { importCandidates } from '../../src/lib/catalog/import';
import { validateCatalog } from '../../src/lib/catalog/validate';
import { runHealth } from './health';
import { runIcons } from './icons';
import {
  enabledLocales,
  loadCatalogInput,
  outletsPath,
  parseFlags,
  readOutlets,
  writeJson,
} from './io';
import { renderReport } from './report';

const [command = 'help', ...rest] = process.argv.slice(2);
const { positional, flags } = parseFlags(rest);

function load() {
  const result = validateCatalog(loadCatalogInput());
  return result;
}

function countriesFromFlag(): string[] {
  const flag = flags.get('country');
  if (flag) return flag.split(',').map((c) => c.trim().toUpperCase());
  return load().catalog.countries.map((c) => c.iso2);
}

function primaryLanguage(iso2: string): string {
  const country = load().catalog.countries.find((c) => c.iso2 === iso2);
  return country?.official_languages[0] ?? 'en';
}

function importRows(iso2: string, rows: Record<string, string>[]): void {
  const existing = readOutlets(iso2);
  const { added, skipped } = importCandidates(iso2, existing, rows, primaryLanguage(iso2));
  writeJson(outletsPath(iso2), [...existing, ...added]);
  console.log(
    `${iso2}: ${added.length} candidates added, ${skipped.length} skipped (already exist)`,
  );
}

async function main(): Promise<number> {
  switch (command) {
    case 'validate': {
      const { catalog, issues } = load();
      for (const issue of issues) {
        const log = issue.severity === 'error' ? console.error : console.warn;
        log(`${issue.severity.toUpperCase()} ${issue.file}: ${issue.message}`);
      }
      const errors = issues.filter((i) => i.severity === 'error').length;
      const outlets = [...catalog.outlets.values()].flat().length;
      console.log(
        `${catalog.countries.length} countries, ${outlets} outlets, ${errors} errors, ${issues.length - errors} warnings`,
      );
      return errors > 0 ? 1 : 0;
    }
    case 'health':
      await runHealth(countriesFromFlag());
      return 0;
    case 'import': {
      const [file] = positional;
      if (!file) throw new Error('Usage: catalog:import <file.csv> [--country XX]');
      const rows = parseCsvRecords(readFileSync(file, 'utf8'));
      const isos = flags.get('country')
        ? countriesFromFlag()
        : [...new Set(rows.map((r) => (r.country ?? '').toUpperCase()).filter(Boolean))];
      for (const iso of isos)
        importRows(
          iso,
          rows.filter((r) => !r.country || r.country.toUpperCase() === iso),
        );
      return 0;
    }
    case 'draft': {
      const iso = flags.get('country')?.toUpperCase();
      const from = flags.get('from');
      if (!iso || !from) throw new Error('Usage: catalog:draft --country XX --from <list.csv>');
      importRows(iso, parseCsvRecords(readFileSync(from, 'utf8')));
      await runHealth([iso]);
      return 0;
    }
    case 'add': {
      const iso = flags.get('country')?.toUpperCase();
      const required = ['name', 'url', 'categories', 'pitch'];
      const missing = required.filter((f) => !flags.has(f));
      if (!iso || missing.length > 0) {
        throw new Error(
          `Usage: catalog:add --country XX --name "…" --url https://… --categories a|b --pitch "…" [--format …] [--paywall …]`,
        );
      }
      importRows(iso, [Object.fromEntries(flags)]);
      return 0;
    }
    case 'icons': {
      const isos = countriesFromFlag();
      await runIcons(isos.flatMap(readOutlets), flags.has('force'));
      return 0;
    }
    case 'report':
      console.log(renderReport(load().catalog, enabledLocales()));
      return 0;
    default:
      console.log(
        'Commands: validate | health [--country XX] | draft --country XX --from list.csv | import file.csv | add | icons [--force] | report',
      );
      return command === 'help' ? 0 : 1;
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  },
);
