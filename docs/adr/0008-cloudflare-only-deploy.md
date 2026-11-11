# 0008. Cloudflare-only deploy, cost model and exit strategy

- Status: superseded by [0014](0014-free-static-hosting-on-github-pages.md) (2026-11-11): the site no longer earns money and is hosted, fully static, on GitHub Pages.
- Date: 2026-10-27

## Context

The v1 draft required both Cloudflare and a Docker/Nginx VPS. `better-sqlite3` does not run on Workers, D1 has its own driver and constraints, and two targets double the test surface for a solo owner. Kubernetes was evaluated and rejected: its operational load and base cost exceed the project's whole budget, and its benefits need scale the product doesn't have.

## Decision

- Deploy only to Cloudflare: Workers (Static Assets + on-demand routes), D1, Analytics Engine, R2 (backups), Turnstile, Access.
- Expected cost: US$ 0/month on free tiers; US$ 5/month (Workers Paid) once traffic exceeds free limits; plus the domain.
- **Exit strategy:** business logic in pure `src/lib/` modules and Drizzle schemas keep a move to a VPS (Astro Node adapter + libSQL) a deploy-config change rather than a rewrite.

## Alternatives considered

- Dual deploy (Cloudflare + VPS): rejected for doubled surface.
- VPS only: loses free global edge delivery of static pages.
- Kubernetes: rejected (operations, cost, no scale need). Gate to reconsider: multiple long-running services or more operators.

## Consequences

- Vendor concentration on Cloudflare, mitigated by the exit strategy and weekly D1 exports to R2.
