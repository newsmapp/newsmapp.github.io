# 0006. Outbound links: direct href with beacon vs /go redirects

- Status: accepted
- Date: 2026-10-27

## Context
Clicks must be counted to prove value to advertisers, but routing every organic link through a redirect hides the hub's genuine linking from search engines and adds latency. A redirect endpoint that accepts arbitrary destinations is an open redirect.

## Decision
- **Organic links:** real `href` to the outlet with `rel="noopener"`, plus `navigator.sendBeacon('/api/track', …)` on click. The click is counted best-effort; navigation never waits for it.
- **Sponsored and affiliate links:** `/go/[id]` with `rel="sponsored noopener"`. The id resolves only against the catalog and `affiliates.json`; no destination parameter is ever accepted. 302 with UTM/affiliate parameters.
- `/go/` is disallowed in `robots.txt`.
- Clicks go to Workers Analytics Engine with a daily-salted visitor hash (never raw IP or User-Agent), bot-score filtering, 30-minute dedup and per-IP rate limiting.

## Alternatives considered
- `/go` for every link: simpler analytics, worse SEO signal and UX.
- Client-side analytics vendor: third-party scripts, cookies and consent burden.

## Consequences
- Organic click counts are lower bounds (ad blockers, disabled JS).
- Paid links never pass ranking signals, protecting against link-scheme penalties.
