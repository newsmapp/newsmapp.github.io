/**
 * Cloudflare Access JWT validation for /admin/ and /api/admin/ (defense in depth: Access
 * already blocks unauthenticated requests at the edge).
 */
interface Jwk extends JsonWebKey {
  kid: string;
}

interface Claims {
  aud?: string | string[];
  iss?: string;
  exp?: number;
  nbf?: number;
  email?: string;
}

const certsCache = new Map<string, { keys: Jwk[]; fetched: number }>();
const CERTS_TTL_MS = 60 * 60 * 1000;
/** After a key rotation, an unknown kid forces a refresh, but at most this often. */
const CERTS_REFRESH_MS = 60 * 1000;

const base64UrlDecode = (value: string): Uint8Array<ArrayBuffer> => {
  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

const decodeJson = <T>(segment: string): T =>
  JSON.parse(new TextDecoder().decode(base64UrlDecode(segment))) as T;

async function signingKeys(
  teamDomain: string,
  fetcher: typeof fetch,
  now: number,
  maxAge = CERTS_TTL_MS,
): Promise<Jwk[]> {
  const cached = certsCache.get(teamDomain);
  if (cached && now - cached.fetched < maxAge) return cached.keys;
  const response = await fetcher(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Access certs: HTTP ${response.status}`);
  const { keys } = (await response.json()) as { keys: Jwk[] };
  certsCache.set(teamDomain, { keys, fetched: now });
  return keys;
}

export interface AccessConfig {
  teamDomain: string;
  aud: string;
  fetcher?: typeof fetch;
  now?: number;
}

/** Returns the verified claims, or null for any invalid, expired or foreign token. */
export async function verifyAccessJwt(
  token: string | null,
  config: AccessConfig,
): Promise<Claims | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
  const now = config.now ?? Date.now();
  try {
    const header = decodeJson<{ alg?: string; kid?: string }>(headerPart);
    if (header.alg !== 'RS256' || !header.kid) return null;
    const fetcher = config.fetcher ?? fetch;
    const byKid = (keys: Jwk[]) => keys.find((k) => k.kid === header.kid);
    const jwk =
      byKid(await signingKeys(config.teamDomain, fetcher, now)) ??
      byKid(await signingKeys(config.teamDomain, fetcher, now, CERTS_REFRESH_MS));
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlDecode(signaturePart),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
    if (!valid) return null;
    const claims = decodeJson<Claims>(payloadPart);
    const seconds = Math.floor(now / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(config.aud)) return null;
    if (claims.iss !== `https://${config.teamDomain}`) return null;
    if (typeof claims.exp !== 'number' || claims.exp <= seconds) return null;
    if (typeof claims.nbf === 'number' && claims.nbf > seconds + 60) return null;
    return claims;
  } catch {
    return null;
  }
}

export interface AdminEnv {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  ADMIN_DEV_BYPASS?: string;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Whether the request may use the admin. With Access configured, only a valid JWT passes.
 * Without it, ADMIN_DEV_BYPASS opens the admin on localhost only, never on a public host.
 */
export async function isAdmin(
  request: Request,
  env: AdminEnv,
  fetcher?: typeof fetch,
): Promise<boolean> {
  if (env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_AUD) {
    const claims = await verifyAccessJwt(request.headers.get('cf-access-jwt-assertion'), {
      teamDomain: env.CF_ACCESS_TEAM_DOMAIN,
      aud: env.CF_ACCESS_AUD,
      ...(fetcher ? { fetcher } : {}),
    });
    return claims !== null;
  }
  return env.ADMIN_DEV_BYPASS === 'true' && LOCAL_HOSTS.has(new URL(request.url).hostname);
}
