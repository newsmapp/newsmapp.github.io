# 0007. Caching, WAF, bot protection and rate limiting

- Status: accepted
- Date: 2026-10-27

## Context

Static pages should be cached aggressively at the edge; dynamic endpoints must never be cached by mistake and must resist spam, scraping and click inflation, all on the free plan where possible.

## Decision

- Static assets are served by Workers Static Assets with long-lived caching for fingerprinted files and short revalidation for HTML.
- Cache bypass for `/api/*`, `/go/*`, `/admin/*`; badges cached for one day at the edge.
- Bot Fight Mode on; one WAF rate-limiting rule on `/api/*`; per-IP limits inside the Worker through the Rate Limiting binding; Turnstile on every public form.
- Security headers through `public/_headers` (static) and the Worker (dynamic). `robots.txt` is not treated as a security control.

## Alternatives considered

- Paid WAF/rate-limiting tiers: unnecessary at launch volumes.
- CAPTCHA vendors: Turnstile is free, private and native to the platform.

## Consequences

- Free-plan WAF rules are few; most protection logic lives in the Worker and is unit-tested.
