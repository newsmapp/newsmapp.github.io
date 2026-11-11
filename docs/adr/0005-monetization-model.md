# 0005. Monetization model: four revenue streams and two enablers

- Status: superseded by [0014](0014-free-static-hosting-on-github-pages.md) (2026-11-11): the site no longer earns money and is hosted, fully static, on GitHub Pages.
- Date: 2026-10-27

## Context

The product must earn recurring revenue without compromising trust in the editorial ranking. The v1 draft listed five "layers", one of which ("Pro") was undefined, and mixed revenue sources with infrastructure.

## Decision

| #   | Type    | Item                                                                                | v1.0                                                       |
| --- | ------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| R1  | Revenue | Sponsored Top-3 slots per country/category, US$ 29/month or US$ 249/year base price | Yes                                                        |
| R2  | Revenue | Contextual affiliates (privacy VPNs, legitimate paid-news access, financial data)   | Yes                                                        |
| R3  | Revenue | Display ads                                                                         | Containers ready, disabled until approval, CMP and traffic |
| R4  | Revenue | Newsletter sponsorship                                                              | Post-launch                                                |
| E1  | Enabler | Click analytics (`/go` + beacon)                                                    | Yes                                                        |
| E2  | Enabler | Backlink badges                                                                     | Yes                                                        |

- Sponsorship state lives in D1; the static build embeds a snapshot of active slots. Approval or expiry triggers a rebuild through GitHub `workflow_dispatch`; a daily cron expires slots.
- Every paid slot goes through editorial review before going live.
- Paid and affiliate links always carry `rel="sponsored noopener"` and a visible text label.

## Alternatives considered

- Rendering sponsored slots at request time (server islands): costs a Worker invocation per pageview for a monthly product.
- Ads from day one: requires traffic and a CMP; hurts performance before there is revenue to justify it.

## Consequences

- Sponsored placements go live about five minutes after approval.
- Revenue reports for advertisers are labeled as estimates (ad blockers drop beacons).
