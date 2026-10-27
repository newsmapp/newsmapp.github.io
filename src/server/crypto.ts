/** Web Crypto helpers (available in Workers and Node). */

const encoder = new TextEncoder();

export const toHex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function hmacSha256(key: string, data: string | ArrayBuffer): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    typeof data === 'string' ? encoder.encode(data) : data,
  );
}

/** Compares two strings without leaking where they differ through timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++)
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

export const newId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;
