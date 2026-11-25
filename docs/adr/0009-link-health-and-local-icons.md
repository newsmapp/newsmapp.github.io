# 0009. Link-health pipeline and local icons

- Status: accepted
- Date: 2026-10-27

## Context

Broken links are the main failure of existing directories. Loading favicons from third-party services in the browser leaks visitor data, slows pages and breaks the CSP.

## Decision

- `pnpm catalog:health` checks every outlet URL and RSS feed with bounded concurrency and an identified User-Agent; records status, final URL and redirects; writes `reports/health-YYYY-MM-DD.json`; proposes changes but never edits `verified` records automatically. Runs weekly in CI and opens an issue with the report.
- `pnpm catalog:icons` downloads favicons at maintenance time into `public/icons/<outlet-id>.webp`, normalized to 40×40 (displayed at 20×20); they are committed. `pnpm catalog:build` generates a deterministic monogram SVG for every outlet without one.
- No icon, font or flag is requested from a third party at runtime.
- Amended 2026-11-25: the `health` block (date, status, final URL and title of the last check) is refreshed on every checked outlet, verified ones included. It is a measurement, not editorial data, and without it the warnings of `catalog:validate` described the day of verification forever. URLs and every other field of a verified record are still never changed automatically.
- Amended 2026-11-25: outlet URLs and their redirects are third-party input. The tools fetch only public `https` targets (no plain http, loopback, private or link-local addresses), cap the size of decoded icons, and the build deploys only the icons of published outlets (`tools/prune-icons.ts`).

## Alternatives considered

- Runtime favicon services: privacy leak and CSP violation.
- Logos scraped at full size: weight and trademark-usage concerns beyond nominative use.

## Consequences

- Icons are part of the repository and the build; adding an outlet means running the icon step.
