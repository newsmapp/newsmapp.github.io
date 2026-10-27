import { beforeAll, describe, expect, it } from 'vitest';
import { isAdmin, verifyAccessJwt } from '@/server/access';
import { GO_ID, redirect, resolveStatic, sponsoredTarget } from '@/server/go';
import type { RuntimeCatalog } from '@/lib/catalog/public';
import type { AffiliatesConfig } from '@/lib/monetization/affiliates';
import { fakeFetch, jsonResponse } from '../helpers/server';

const TEAM = 'newsmap.cloudflareaccess.com';
const AUD = 'aud-123';
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

let keys: CryptoKeyPair;
let jwk: JsonWebKey;
let tokenCounter = 0;

async function sign(claims: Record<string, unknown>, kid = 'k1', alg = 'RS256'): Promise<string> {
  const head = `${encode({ alg, kid })}.${encode(claims)}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keys.privateKey,
    new TextEncoder().encode(head),
  );
  return `${head}.${Buffer.from(signature).toString('base64url')}`;
}

beforeAll(async () => {
  keys = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
});

describe('verifyAccessJwt', () => {
  // A distinct team domain per test avoids the module's certificate cache.
  const setup = () => {
    const team = `t${++tokenCounter}.${TEAM}`;
    const certs = fakeFetch(() => jsonResponse({ keys: [{ ...jwk, kid: 'k1' }] }));
    const now = Date.UTC(2026, 10, 1);
    const claims = {
      aud: [AUD],
      iss: `https://${team}`,
      exp: now / 1000 + 600,
      email: 'editor@example.com',
    };
    return {
      team,
      certs,
      now,
      claims,
      config: { teamDomain: team, aud: AUD, fetcher: certs.fetcher, now },
    };
  };

  it('accepts a valid token and caches the signing keys', async () => {
    const { certs, claims, config, team } = setup();
    expect(await verifyAccessJwt(await sign(claims), config)).toMatchObject({
      email: 'editor@example.com',
    });
    expect(await verifyAccessJwt(await sign({ ...claims, aud: AUD }), config)).not.toBeNull();
    expect(certs.calls).toHaveLength(1);
    expect(certs.calls[0]?.url).toBe(`https://${team}/cdn-cgi/access/certs`);
  });

  it('rejects wrong audience, issuer, expiry, key, algorithm and garbage', async () => {
    const { claims, config, now } = setup();
    const rejected = [
      await sign({ ...claims, aud: ['other'] }),
      await sign({ ...claims, iss: 'https://evil.example' }),
      await sign({ ...claims, exp: now / 1000 - 1 }),
      await sign({ ...claims, exp: undefined }),
      await sign({ ...claims, nbf: now / 1000 + 3600 }),
      await sign(claims, 'unknown-kid'),
      await sign(claims, 'k1', 'HS256'),
      'a.b',
      'not.a.jwt',
      null,
    ];
    for (const token of rejected) expect(await verifyAccessJwt(token, config)).toBeNull();
    const valid = await sign(claims);
    const tampered = `${valid.split('.')[0]}.${encode({ ...claims, email: 'x@example.com' })}.${valid.split('.')[2]}`;
    expect(await verifyAccessJwt(tampered, config)).toBeNull();
  });

  it('refetches the keys once for an unknown kid after a rotation, at most once a minute', async () => {
    const { claims, now, team } = setup();
    let current = 'k1';
    const certs = fakeFetch(() => jsonResponse({ keys: [{ ...jwk, kid: current }] }));
    const at = (ms: number) => ({ teamDomain: team, aud: AUD, fetcher: certs.fetcher, now: ms });
    expect(await verifyAccessJwt(await sign(claims), at(now))).not.toBeNull();
    current = 'k2';
    // Inside the refresh window the cached keys stand: no fetch per forged kid.
    expect(await verifyAccessJwt(await sign(claims, 'k2'), at(now + 30_000))).toBeNull();
    expect(certs.calls).toHaveLength(1);
    expect(await verifyAccessJwt(await sign(claims, 'k2'), at(now + 61_000))).not.toBeNull();
    expect(certs.calls).toHaveLength(2);
  });

  it('returns null when the certificates cannot be fetched', async () => {
    const { claims } = setup();
    const down = fakeFetch(() => new Response('', { status: 500 }));
    expect(
      await verifyAccessJwt(await sign(claims), {
        teamDomain: 'down.example',
        aud: AUD,
        fetcher: down.fetcher,
      }),
    ).toBeNull();
  });
});

describe('isAdmin', () => {
  const request = (host: string, token?: string) =>
    new Request(
      `https://${host}/admin/`,
      token ? { headers: { 'cf-access-jwt-assertion': token } } : {},
    );

  it('opens the dev bypass on localhost only', async () => {
    expect(
      await isAdmin(new Request('http://localhost:4321/admin/'), { ADMIN_DEV_BYPASS: 'true' }),
    ).toBe(true);
    expect(await isAdmin(request('newsmap.example'), { ADMIN_DEV_BYPASS: 'true' })).toBe(false);
    expect(await isAdmin(new Request('http://localhost/admin/'), {})).toBe(false);
  });

  it('requires a valid Access token once Access is configured, bypass or not', async () => {
    const team = `admin.${TEAM}`;
    const certs = fakeFetch(() => jsonResponse({ keys: [{ ...jwk, kid: 'k1' }] }));
    const env = { CF_ACCESS_TEAM_DOMAIN: team, CF_ACCESS_AUD: AUD, ADMIN_DEV_BYPASS: 'true' };
    const token = await sign({ aud: AUD, iss: `https://${team}`, exp: Date.now() / 1000 + 600 });
    expect(await isAdmin(request('newsmap.example', token), env, certs.fetcher)).toBe(true);
    expect(await isAdmin(new Request('http://localhost/admin/'), env, certs.fetcher)).toBe(false);
  });
});

describe('/go/ resolution', () => {
  const catalog = {
    'pt-a': {
      name: 'A',
      url: 'https://a.example.com/news?x=1',
      country: 'PT',
      slug: 'a',
      categories: ['sports', 'politics'],
      country_slug: 'portugal',
      country_name: 'Portugal',
      badge: { position: 1, category: 'sports' },
    },
  } satisfies RuntimeCatalog;
  const affiliates = {
    affiliates: [
      {
        id: 'vpn-travel',
        name: 'VPN',
        context: 'vpn-travel',
        url: 'https://vpn.example/',
        params: { ref: 'nm' },
        headline: 'h',
        body: 'b',
        cta: 'c',
        active: true,
      },
      {
        id: 'off',
        name: 'Off',
        context: 'finance',
        url: 'https://off.example/',
        params: {},
        headline: 'h',
        body: 'b',
        cta: 'c',
        active: false,
      },
    ],
    rules: { by_category: {}, by_paywall: {} },
  } as AffiliatesConfig;

  it('resolves catalog outlets with referral parameters', () => {
    const target = resolveStatic('pt-a', catalog, affiliates);
    expect(target).toMatchObject({
      outletId: 'pt-a',
      country: 'PT',
      category: 'sports',
      sponsored: false,
    });
    const url = new URL(target!.url);
    expect(url.origin + url.pathname).toBe('https://a.example.com/news');
    expect(url.searchParams.get('x')).toBe('1');
    expect(url.searchParams.get('utm_medium')).toBe('referral');
  });

  it('resolves only active affiliates', () => {
    expect(resolveStatic('aff-vpn-travel', catalog, affiliates)?.url).toBe(
      'https://vpn.example/?ref=nm',
    );
    expect(resolveStatic('aff-off', catalog, affiliates)).toBeNull();
  });

  it('never resolves anything outside the allowlists', () => {
    for (const id of [
      'https://evil.example',
      '//evil.example',
      'constructor',
      '__proto__',
      'toString',
      'PT-A',
      '',
      'x'.repeat(121),
    ]) {
      expect(resolveStatic(id, catalog, affiliates)).toBeNull();
    }
    expect(GO_ID.test('sp-6f1c2e8a-0000-4000-8000-000000000000')).toBe(true);
  });

  it('tags sponsored targets and redirects without caching', () => {
    const target = sponsoredTarget({
      id: 'sp-1',
      outlet_url: 'https://s.example/',
      country_iso: 'PT',
      category: 'sports',
    });
    expect(new URL(target.url).searchParams.get('utm_campaign')).toBe('pt-sports');
    const response = redirect(target.url);
    expect(response.status).toBe(302);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
  });
});
