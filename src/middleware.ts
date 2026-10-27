import { defineMiddleware } from 'astro:middleware';

/**
 * Security headers for on-demand responses. Static pages get the same set from public/_headers;
 * Worker responses never pass through that file.
 */
const HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
};

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (context.isPrerendered) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(HEADERS))
    if (!headers.has(name)) headers.set(name, value);
  if (!headers.has('content-security-policy'))
    headers.set('content-security-policy', "frame-ancestors 'none'");
  if (context.url.pathname.startsWith('/admin/') || context.url.pathname.startsWith('/api/')) {
    headers.set('x-robots-tag', 'noindex');
    if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
