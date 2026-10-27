import { mkdirSync } from 'node:fs';
import type { Outlet } from '../../src/schemas/catalog.schema';
import { decodeHtml, extractTitle, fetchTracked, pool, registrableHost, type Hop } from './http';
import { outletsPath, readOutlets, today, writeJson } from './io';

export interface HealthEntry {
  id: string;
  status: Outlet['status'];
  url: string;
  http_status: number | null;
  final_url: string;
  hops: Hop[];
  title: string | null;
  error: string | null;
  rss: { url: string; http_status: number | null; valid: boolean } | null;
  findings: string[];
}

const PERMANENT = new Set([301, 308]);

/** Classifies a check into human-readable findings; empty means healthy. */
export function findingsFor(entry: Omit<HealthEntry, 'findings'>): string[] {
  const findings: string[] = [];
  if (entry.error) findings.push(`unreachable (${entry.error})`);
  else if (entry.http_status !== null && entry.http_status >= 400) {
    findings.push(`HTTP ${entry.http_status}`);
  }
  if (entry.hops.some((hop) => PERMANENT.has(hop.status)) && entry.final_url !== entry.url) {
    findings.push(`permanent redirect to ${entry.final_url}`);
  }
  try {
    if (registrableHost(entry.final_url) !== registrableHost(entry.url)) {
      findings.push(`domain changed to ${new URL(entry.final_url).hostname}`);
    }
  } catch {
    findings.push('invalid final URL');
  }
  if (entry.rss && !entry.rss.valid)
    findings.push(`RSS invalid (HTTP ${entry.rss.http_status ?? 'none'})`);
  return findings;
}

async function check(outlet: Outlet): Promise<HealthEntry> {
  const page = await fetchTracked(outlet.url);
  const html = page.body.length > 0 ? decodeHtml(page.body, page.contentType) : '';
  let rss: HealthEntry['rss'] = null;
  if (outlet.rss_url) {
    const feed = await fetchTracked(
      outlet.rss_url,
      'application/rss+xml,application/atom+xml,application/xml,*/*',
    );
    const text = new TextDecoder().decode(feed.body.subarray(0, 2048));
    rss = {
      url: outlet.rss_url,
      http_status: feed.status,
      valid: feed.status === 200 && /<(rss|feed|rdf:RDF)[\s>]/i.test(text),
    };
  }
  const entry = {
    id: outlet.id,
    status: outlet.status,
    url: outlet.url,
    http_status: page.status,
    final_url: page.finalUrl,
    hops: page.hops,
    title: extractTitle(html),
    error: page.error,
    rss,
  };
  return { ...entry, findings: findingsFor(entry) };
}

/**
 * Checks every non-retired outlet of the given countries and writes a dated report.
 * Only `candidate` outlets get their `health` block updated; verified data is never touched.
 */
export async function runHealth(isos: string[]): Promise<HealthEntry[]> {
  const all: HealthEntry[] = [];
  for (const iso of isos) {
    const outlets = readOutlets(iso);
    const targets = outlets.filter((o) => o.status !== 'retired');
    const entries = await pool(targets, 8, check);
    const byId = new Map(entries.map((e) => [e.id, e]));
    const updated = outlets.map((outlet) => {
      const entry = byId.get(outlet.id);
      if (!entry || outlet.status !== 'candidate') return outlet;
      return {
        ...outlet,
        health: {
          last_checked: today(),
          http_status: entry.http_status,
          final_url: entry.error ? null : entry.final_url,
          title: entry.title,
        },
      };
    });
    if (outlets.length > 0) {
      writeJson(outletsPath(iso), updated);
    }
    const flagged = entries.filter((e) => e.findings.length > 0);
    console.log(`${iso}: ${entries.length} checked, ${flagged.length} with findings`);
    for (const entry of flagged) console.log(`  ${entry.id}: ${entry.findings.join('; ')}`);
    all.push(...entries);
  }
  mkdirSync('reports', { recursive: true });
  const path = `reports/health-${today()}.json`;
  writeJson(path, {
    checked_at: new Date().toISOString(),
    countries: isos,
    proposals: all
      .filter((e) => e.findings.length > 0)
      .map((e) => ({ id: e.id, status: e.status, findings: e.findings, final_url: e.final_url })),
    results: all,
  });
  console.log(`Report: ${path}`);
  return all;
}
