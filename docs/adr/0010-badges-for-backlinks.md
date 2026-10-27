# 0010. Badges for backlink acquisition within search guidelines

- Status: accepted
- Date: 2026-10-27

## Context

Listed outlets may display a "Listed on NewsMapp" badge, earning links back to the directory. Search engines treat keyword-rich widget links as link schemes.

## Decision

- `GET /badge/[country]/[outlet].svg` renders a small SVG in the Worker, cached one day at the edge: "Listed on NewsMapp · #N in [Category], [Country]". Every interpolated string is XML-escaped; the response carries `Content-Type: image/svg+xml` and a restrictive CSP.
- The copyable snippet uses brand-only anchor text and `alt` ("NewsMapp"), no keywords. For sponsored outlets the snippet includes `rel="sponsored"`.
- Outreach is manual and documented in the SEO playbook.

## Alternatives considered

- Keyword anchors ("Top sports newspapers in Brazil"): higher short-term value, real penalty risk.
- Static badge files: can't reflect current rank.

## Consequences

- Backlink gains are uncertain and slow; the badge is a low-cost enabler, not a growth plan.
