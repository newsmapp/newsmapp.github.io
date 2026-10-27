/** Shared HTTP helpers for health checks and icon downloads. */

const SITE_URL = process.env.SITE_URL ?? 'https://newsmap.example';
export const USER_AGENT = `NewsMapBot/1.0 (+${SITE_URL}/methodology/)`;
const TIMEOUT_MS = 15_000;
const MAX_BODY = 512 * 1024;

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
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (match, entity: string) => {
      if (entity.startsWith('#x') || entity.startsWith('#X'))
        return String.fromCodePoint(parseInt(entity.slice(2), 16));
      if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(1), 10));
      return ENTITIES[entity.toLowerCase()] ?? match;
    })
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
