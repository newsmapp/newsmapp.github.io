# 0011. Data quality and editorial methodology

- Status: accepted
- Date: 2026-10-27

## Context
The catalog is the product. Labels like "state media" or a political lean applied to real outlets carry legal and reputational risk. Generated data can invent URLs, owners and dates.

## Decision
- Outlet status lifecycle: `candidate` (draft, never published) → `verified` (set only by the owner) → `retired`.
- Agents and tools may draft candidates; every candidate is health-checked and records the final URL and the site's `<title>` to speed up human review.
- Ownership type and political lean are separate fields. `political_lean` defaults to `unrated`; any other value requires a source URL. `state-controlled` requires a source.
- Editorial text (`summary`, `faq`, category `intro`, `about`) requires `reviewed: true` before publication; facts need sources.
- Public methodology page and a corrections form; corrections enter through catalog commits.

## Alternatives considered
- Importing a third-party bias dataset: licensing issues and inherited disputes.
- Fully automated enrichment: unacceptable error rate for a trust product.

## Consequences
- Launch depends on the owner's verification throughput; `catalog:report` shows what each country is missing.
