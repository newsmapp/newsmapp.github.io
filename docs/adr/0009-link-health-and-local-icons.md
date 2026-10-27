# 0009. Link-health pipeline and local icons

- Status: accepted
- Date: 2026-10-27

## Context
Broken links are the main failure of existing directories. Loading favicons from third-party services in the browser leaks visitor data, slows pages and breaks the CSP.

## Decision
- `pnpm catalog:health` checks every outlet URL and RSS feed with bounded concurrency and an identified User-Agent; records status, final URL and redirects; writes `reports/health-YYYY-MM-DD.json`; proposes changes but never edits `verified` records automatically. Runs weekly in CI and opens an issue with the report.
- `pnpm catalog:icons` downloads favicons at build/maintenance time into `public/icons/outlets/`, normalized to 40×40 (displayed at 20×20), and generates a deterministic monogram SVG for every outlet as the fallback.
- No icon, font or flag is requested from a third party at runtime.

## Alternatives considered
- Runtime favicon services: privacy leak and CSP violation.
- Logos scraped at full size: weight and trademark-usage concerns beyond nominative use.

## Consequences
- Icons are part of the repository and the build; adding an outlet means running the icon step.
