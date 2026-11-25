/** Shared HTTP helpers for health checks and icon downloads. */
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

/**
 * Where site owners can read who is calling: the methodology page when SITE_URL is known, else
 * the public repository (always set on GitHub Actions, where the weekly check runs).
 */
const CONTACT = process.env.SITE_URL
  ? `${process.env.SITE_URL.replace(/\/$/, '')}/methodology/`
  : `https://github.com/${process.env.GITHUB_REPOSITORY ?? 'newsmapp/newsmapp.github.io'}`;
export const USER_AGENT = `NewsMappBot/1.0 (+${CONTACT})`;
const TIMEOUT_MS = 15_000;
const MAX_BODY = 512 * 1024;

/**
 * Catalog URLs and their redirects come from third-party sites. Only public https targets are
 * fetched, so a hostile redirect cannot reach the runner's network, a local service or plain http.
 */
const PRIVATE = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
] as const)
  PRIVATE.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of [
  ['::', 127],
  ['64:ff9b::', 96],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const)
  PRIVATE.addSubnet(net, prefix, 'ipv6');

export const isPrivateAddress = (address: string): boolean => {
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) is judged by its IPv4 address. BlockList cannot hold a
  // ::ffff:0:0/96 rule for this: it matches every plain IPv4 address too.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return isPrivateAddress(mapped);
  const family = isIP(address);
  if (family === 0) return false;
  return PRIVATE.check(address, family === 4 ? 'ipv4' : 'ipv6');
};

/** Why a URL must not be fetched, or null when it is a public https target. */
export async function blockedReason(
  url: string,
  resolve: (host: string) => Promise<string[]> = async (host) =>
    (await lookup(host, { all: true })).map((entry) => entry.address),
): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'invalid URL';
  }
  if (parsed.protocol !== 'https:') return `non-https URL (${parsed.protocol.replace(':', '')})`;
  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return 'private address';
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : await resolve(host);
  } catch {
    return null; // Let fetch report the DNS error as it normally would.
  }
  return addresses.some(isPrivateAddress) ? 'private address' : null;
}

export interface Hop {
  url: string;
  status: number;
}

export interface FetchResult {
  hops: Hop[];
  finalUrl: string;
  status: number | null;
  contentType: string;
  body: Uint8Array;
  error: string | null;
}

async function readCapped(response: Response): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BODY) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const out = new Uint8Array(Math.min(size, MAX_BODY));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, out.length - offset);
    out.set(slice, offset);
    offset += slice.length;
  }
  return out;
}

/** GET following up to 6 redirects by hand so permanent redirects are visible. */
export async function fetchTracked(url: string, accept = 'text/html,*/*'): Promise<FetchResult> {
  const hops: Hop[] = [];
  let current = url;
  try {
    for (let i = 0; i < 7; i += 1) {
      const blocked = await blockedReason(current);
      if (blocked) {
        return {
          hops,
          finalUrl: current,
          status: null,
          contentType: '',
          body: new Uint8Array(),
          error: `blocked: ${blocked}`,
        };
      }
      const response = await fetch(current, {
        redirect: 'manual',
        headers: { 'user-agent': USER_AGENT, accept, 'accept-language': 'en,*;q=0.5' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      hops.push({ url: current, status: response.status });
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel();
        current = new URL(location, current).toString();
        continue;
      }
      return {
        hops,
        finalUrl: current,
        status: response.status,
        contentType: response.headers.get('content-type') ?? '',
        body: await readCapped(response),
        error: null,
      };
    }
    return {
      hops,
      finalUrl: current,
      status: null,
      contentType: '',
      body: new Uint8Array(),
      error: 'too many redirects',
    };
  } catch (cause) {
    const error = cause as Error & { cause?: { code?: string } };
    return {
      hops,
      finalUrl: current,
      status: null,
      contentType: '',
      body: new Uint8Array(),
      error: error.cause?.code ?? error.name ?? 'fetch failed',
    };
  }
}

/** Decodes HTML honoring the charset from the header or a <meta> tag. */
export function decodeHtml(body: Uint8Array, contentType: string): string {
  const fromHeader = /charset=([\w-]+)/i.exec(contentType)?.[1];
  const sniff = new TextDecoder('latin1').decode(body.subarray(0, 4096));
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(sniff)?.[1];
  const charset = (fromHeader ?? fromMeta ?? 'utf-8').toLowerCase();
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
}

// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function extractTitle(html: string): string | null {
  const raw = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  if (!raw) return null;
  const title = raw
    .replace(/&(#x[0-9a-f]+|#[0-9]+|\w+);/gi, (match, entity: string) => {
      if (entity.startsWith('#')) {
        const hex = entity[1] === 'x' || entity[1] === 'X';
        const code = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        // Out-of-range references (&#x110000;) are left as written instead of throwing.
        return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
      }
      return ENTITIES[entity.toLowerCase()] ?? match;
    })
    .replace(CONTROL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return title === '' ? null : title.slice(0, 200);
}

/** Runs tasks with a fixed concurrency, preserving input order in the result. */
export async function pool<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

export const registrableHost = (url: string): string => new URL(url).hostname.replace(/^www\./, '');
