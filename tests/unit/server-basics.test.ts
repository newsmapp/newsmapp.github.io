import { describe, expect, it } from 'vitest';
import {
  botBucket,
  clickDataPoint,
  filteredClicksSql,
  queryClicks,
  visitorHash,
} from '@/server/analytics';
import { hmacSha256, newId, timingSafeEqual, toHex } from '@/server/crypto';
import { addDays, addMinutes, iso } from '@/server/db';
import {
  clientIp,
  fieldErrors,
  json,
  problem,
  readJson,
  respond,
  sameOrigin,
  visitorCountry,
} from '@/server/http';
import { verifyTurnstile } from '@/server/turnstile';
import { dispatchRebuild } from '@/server/rebuild';
import { fakeFetch, jsonResponse } from '../helpers/server';

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request('https://newsmap.example/api/x/', { method: 'POST', body, headers });

describe('http', () => {
  it('builds JSON and problem responses that are never cached', async () => {
    const response = json({ ok: true }, 201);
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await problem(422, 'Bad', { url: 'x' }).json()).toEqual({
      error: 'Bad',
      fields: { url: 'x' },
    });
    expect(await problem(400, 'Bad').json()).toEqual({ error: 'Bad' });
  });

  it('reads JSON within the size limit and throws responses otherwise', async () => {
    expect(await readJson(post('{"a":1}'))).toEqual({ a: 1 });
    await expect(readJson(post('{"a":1}', { 'content-length': '999999' }))).rejects.toHaveProperty(
      'status',
      413,
    );
    await expect(readJson(post('x'.repeat(50), {}), 10)).rejects.toHaveProperty('status', 413);
    await expect(readJson(post('{oops'))).rejects.toHaveProperty('status', 400);
  });

  it('maps schema issues to messages written for people', () => {
    expect(
      fieldErrors([
        { path: ['url'], message: 'dev message' },
        { path: ['url'], message: 'second' },
        { path: ['mystery'], message: 'dev' },
        { path: [], message: 'root' },
      ]),
    ).toEqual({
      url: 'Enter the full address, starting with https://.',
      mystery: 'Check this field.',
      form: 'Check this field.',
    });
  });

  it('reads the client address and country from Cloudflare headers', () => {
    const request = new Request('https://newsmap.example/', {
      headers: { 'cf-connecting-ip': '203.0.113.9', 'cf-ipcountry': 'br' },
    });
    expect(clientIp(request)).toBe('203.0.113.9');
    expect(clientIp(new Request('https://newsmap.example/'))).toBe('');
    expect(visitorCountry(request)).toBe('BR');
    for (const unknown of ['XX', 'T1', '', 'ZZZ']) {
      expect(
        visitorCountry(new Request('https://x.example/', { headers: { 'cf-ipcountry': unknown } })),
      ).toBeNull();
    }
  });

  it('accepts only same-origin state changes', () => {
    expect(sameOrigin(post('', { origin: 'https://newsmap.example' }))).toBe(true);
    expect(sameOrigin(post('', { origin: 'https://evil.example' }))).toBe(false);
    expect(sameOrigin(post(''))).toBe(false);
  });

  it('returns thrown responses and hides unexpected errors', async () => {
    expect((await respond(async () => Promise.reject(problem(418, 'x')))).status).toBe(418);
    const original = console.error;
    console.error = () => {};
    const failed = await respond(async () => Promise.reject(new Error('db down')));
    console.error = original;
    expect(failed.status).toBe(500);
    expect(JSON.stringify(await failed.json())).not.toContain('db down');
  });
});

describe('crypto and time', () => {
  it('computes HMAC-SHA256 like the reference vector', async () => {
    // RFC 4231 test case 2.
    expect(toHex(await hmacSha256('Jefe', 'what do ya want for nothing?'))).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });

  it('compares in constant time, including different lengths', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(newId('sp')).toMatch(/^sp-[0-9a-f-]{36}$/);
  });

  it('formats and shifts timestamps', () => {
    const t = new Date('2026-01-31T00:00:00.000Z');
    expect(iso(addMinutes(t, 30))).toBe('2026-01-31T00:30:00.000Z');
    expect(iso(addDays(t, 7))).toBe('2026-02-07T00:00:00.000Z');
  });
});

describe('analytics', () => {
  it('hashes visitors with a key that changes every day and keeps no raw data', async () => {
    const a = await visitorHash('secret', '2026-11-01', '203.0.113.9', 'Mozilla/5.0');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await visitorHash('secret', '2026-11-01', '203.0.113.9', 'Mozilla/5.0')).toBe(a);
    expect(await visitorHash('secret', '2026-11-02', '203.0.113.9', 'Mozilla/5.0')).not.toBe(a);
    expect(a).not.toContain('203');
  });

  it('classifies bots by score, verified flag or user agent', () => {
    expect(botBucket('Mozilla/5.0', 5)).toBe('bot');
    expect(botBucket('Mozilla/5.0', 20)).toBe('likely-bot');
    expect(botBucket('Mozilla/5.0', 90)).toBe('human');
    expect(botBucket('Mozilla/5.0', null, true)).toBe('bot');
    expect(botBucket('Googlebot/2.1')).toBe('bot');
    expect(botBucket('')).toBe('bot');
    expect(botBucket('Mozilla/5.0 (Macintosh)')).toBe('human');
  });

  it('writes a data point without IP or user agent', () => {
    const point = clickDataPoint({
      outletId: 'pt-a',
      country: 'PT',
      category: 'sports',
      visitorCountry: null,
      sponsored: true,
      source: 'go',
      bot: 'human',
      visitor: 'abc',
    });
    expect(point).toEqual({
      indexes: ['pt-a'],
      blobs: ['pt-a', 'PT', 'sports', '', 'go', 'human', 'abc'],
      doubles: [1],
    });
  });

  it('builds the filtered-clicks query with a bounded window', () => {
    const sql = filteredClicksSql('newsmap_clicks', 9999, 'blob2');
    expect(sql).toContain("INTERVAL '90' DAY");
    expect(sql).toContain("blob6 = 'human'");
    expect(sql).toContain('SELECT blob2 AS key');
    expect(filteredClicksSql('d', 0, 'blob1')).toContain("INTERVAL '1' DAY");
  });

  it('queries the SQL API only when configured', async () => {
    expect(await queryClicks(undefined, 't', 'SELECT 1')).toBeNull();
    const ok = fakeFetch(() => jsonResponse({ data: [{ key: 'pt-a', clicks: '3' }] }));
    expect(await queryClicks('acc', 'tok', 'SELECT 1', ok.fetcher)).toEqual([
      { key: 'pt-a', clicks: 3 },
    ]);
    expect(ok.calls[0]?.url).toContain('/accounts/acc/analytics_engine/sql');
    expect(
      await queryClicks(
        'acc',
        'tok',
        'x',
        fakeFetch(() => new Response('', { status: 500 })).fetcher,
      ),
    ).toBeNull();
    expect(await queryClicks('acc', 'tok', 'x', fakeFetch(() => jsonResponse({})).fetcher)).toEqual(
      [],
    );
  });
});

describe('turnstile', () => {
  it('passes only an explicit success and fails closed', async () => {
    const ok = fakeFetch(() => jsonResponse({ success: true }));
    expect(await verifyTurnstile('t', 's', '203.0.113.9', ok.fetcher)).toBe(true);
    const sent = ok.calls[0]?.init?.body as FormData;
    expect(sent.get('remoteip')).toBe('203.0.113.9');
    expect(
      await verifyTurnstile(
        't',
        's',
        '',
        fakeFetch(() => jsonResponse({ success: false })).fetcher,
      ),
    ).toBe(false);
    expect(
      await verifyTurnstile(
        't',
        's',
        '',
        fakeFetch(() => new Response('', { status: 500 })).fetcher,
      ),
    ).toBe(false);
    expect(
      await verifyTurnstile(
        't',
        's',
        '',
        fakeFetch(() => Promise.reject(new Error('network'))).fetcher,
      ),
    ).toBe(false);
  });
});

describe('rebuild', () => {
  it('dispatches the deploy workflow when a token is configured', async () => {
    const warn = console.warn;
    console.warn = () => {};
    expect(await dispatchRebuild({}, 'x')).toBe(false);
    console.warn = warn;
    const gh = fakeFetch(() => new Response(null, { status: 204 }));
    expect(
      await dispatchRebuild(
        { GITHUB_DISPATCH_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' },
        'r'.repeat(300),
        gh.fetcher,
      ),
    ).toBe(true);
    expect(gh.calls[0]?.url).toBe(
      'https://api.github.com/repos/o/r/actions/workflows/deploy.yml/dispatches',
    );
    expect(JSON.parse(String(gh.calls[0]?.init?.body)).inputs.reason).toHaveLength(100);
    const error = console.error;
    console.error = () => {};
    const failing = fakeFetch(() => new Response(null, { status: 404 }));
    expect(
      await dispatchRebuild(
        { GITHUB_DISPATCH_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' },
        'r',
        failing.fetcher,
      ),
    ).toBe(false);
    console.error = error;
  });
});
