# 0002. Data model: Git catalog (Zod) × D1 (Drizzle) × Analytics Engine

- Status: accepted
- Date: 2026-10-27

## Context

Two very different kinds of data exist: a curated, reviewable catalog (countries, outlets, editorial text) and operational records written at runtime (submissions, sponsorships, webhook events, correction requests, clicks). The v1 draft of the spec stored sponsorship state in both places, creating two sources of truth.

## Decision

- **Catalog in Git:** `data/geo`, `data/countries`, `data/outlets`, `data/monetization`. Validated by Zod at build time; the build fails on any violation. Reviewed through commits.
- **Operational data in Cloudflare D1** through Drizzle ORM: `submissions`, `sponsorships`, `webhook_events`, `correction_requests`.
- **Clicks in Workers Analytics Engine** (append-only, aggregated by SQL API).
- **One source of truth per entity.** Sponsorship state never appears in the catalog; the build reads a snapshot of active sponsorships exported from D1.

## Alternatives considered

- **Everything in D1:** loses Git review and diff for editorial data; makes the catalog harder for the owner to audit.
- **Clicks in D1:** one write per click against the free-tier write quota; Analytics Engine is built for this.
- **Hosted Postgres:** monthly cost and an extra vendor for a small operational dataset.

## Consequences

- Catalog changes are code-reviewed and versioned; rollbacks are `git revert`.
- D1 has no interactive transactions; atomic multi-statement writes use `db.batch()`.
- Sponsored placements appear after a rebuild (≈5 minutes), documented in ADR 0005.
