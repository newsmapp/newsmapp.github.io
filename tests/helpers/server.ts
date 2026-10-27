import { database, type Database } from '@/server/db';
import { createTestD1 } from './d1';

export const NOW = new Date('2026-11-01T12:00:00.000Z');
export const testDb = (): Database => database(createTestD1());

export interface Call {
  url: string;
  init: RequestInit | undefined;
}

/** fetch double: records calls and answers with the given handler. */
export function fakeFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  const calls: Call[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return { fetcher, calls };
}

export const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
