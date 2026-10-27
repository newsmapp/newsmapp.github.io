# 0001. Astro 5 static-first with on-demand routes on Cloudflare Workers

- Status: accepted
- Date: 2026-10-27

## Context
NewsMap is a directory: thousands of read-mostly pages and a handful of dynamic endpoints (click redirects, forms, payment webhooks, badges, admin). The business case requires infrastructure cost of US$ 0–5/month, top Core Web Vitals and HTML that works without JavaScript for crawlers and slow mobile connections.

## Decision
- Astro 5 with `@astrojs/cloudflare`, `output: 'static'` by default. Every directory page is prerendered at build time.
- Only `/go/*`, `/api/*`, `/badge/*` and `/admin/*` opt out with `export const prerender = false`.
- Hosting on Cloudflare Workers with Static Assets: static requests are served from the edge without invoking the Worker; only dynamic routes count against Worker limits.
- Interactivity limited to two Preact islands (command palette, filter bar). Detail cards use the native Popover API.
- Business logic lives in pure functions under `src/lib/` with no dependency on the Cloudflare runtime.

## Alternatives considered
- **Next.js on Vercel/Cloudflare:** heavier client runtime by default, more JS shipped, higher cost at scale.
- **Pure SSG + separate API project:** two deployables for a handful of endpoints; Astro's hybrid model keeps one.
- **SPA:** rejected outright; crawlers and slow connections need HTML.

## Consequences
- Near-zero hosting cost; the static part scales with the CDN.
- Any catalog change requires a rebuild (minutes), acceptable for curated data.
- Dynamic features that depend on the visitor (geo, slot availability) must go through small API calls, never through cached HTML.
- Revisit if per-request personalization becomes core to the product.
