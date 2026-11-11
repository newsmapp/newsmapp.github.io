# NewsMapp

<p align="center"><img src="docs/brand/logo.webp" alt="NewsMapp" width="360"></p>

A global directory of news outlets, organised by country and category. Free and non-commercial: no ads, no sponsored listings, no affiliate links. A fully static Astro site, built from the catalog in `data/` and hosted for free on GitHub Pages from a GitHub Organization (ADR 0014). Corrections and outlet suggestions arrive as GitHub issue forms.

- What the product must do: `SPEC.md` (source of truth, kept locally by the owner, not versioned; ADR 0014 overrides its revenue sections). Why it is built this way: `docs/adr/`.
- How to contribute and the repository rules: `AGENTS.md`.
- Production deploy, step by step: `docs/runbooks/deploy.md`.

## Run it locally

Requires Node 24 (`nvm use 24`; dependency-cruiser refuses Node 25) and pnpm 10.

```sh
pnpm install
pnpm dev                           # http://localhost:4321
```

To see the real output the way GitHub Pages serves it (directory indexes, `404.html`, search index):

```sh
pnpm build && pnpm preview                                       # http://localhost:4321
CATALOG_DIR=tests/fixtures/catalog pnpm build && pnpm preview    # the small fixtures catalog
```

`pnpm check` runs everything a commit must pass; CI (`.github/workflows/ci.yml`) also runs the builds, SEO audit, E2E with accessibility checks and Lighthouse.

## Go live on GitHub Pages (about 15 minutes of clicks)

The full runbook, with verification for every step, is `docs/runbooks/deploy.md`. The short version:

1. Create the free GitHub Organization `newsmapp`, with 2FA required.
2. Create the **public** repository `newsmapp/newsmapp.github.io` and push this repository to it. Check the history for anything private first: once public, it is public for good.
3. Settings → Pages → Source: GitHub Actions.
4. Wait for CI on `main`; Deploy publishes https://newsmapp.github.io/. No secrets are needed.
5. Create the `correction` and `suggestion` labels, protect `main` with a ruleset, submit the sitemap in Search Console.

Afterwards every green CI run on `main` deploys on its own. A weekly job opens a catalog link-health issue (`.github/workflows/scheduled.yml`).

The site must sit at the root of its origin, which `newsmapp.github.io` is: a project site such as `https://newsmapp.github.io/<repo>/` is refused at build time because every link is root-relative.

## Catalog: from draft to published

Git is the CMS: every outlet and country is a JSON file in `data/`, validated by the Zod schemas in `src/schemas/`. Tools only ever create `candidate` outlets; only you mark an outlet `verified` or a country `published`.

1. Draft candidates from a CSV (columns: `name, url, categories, pitch` required; `slug, rss_url, language, region, founded_year, paywall, ownership_type, owner, ownership_source, format, editor_pick` optional; `categories` separated by `|`):

   ```sh
   pnpm catalog:draft --country BR --from list.csv
   pnpm catalog:add --country BR --name "…" --url https://… --categories general-news --pitch "…"
   ```

2. Check links and fetch icons. `catalog:health` writes `reports/health-<date>.json` with redirects, dead links and invalid feeds; `catalog:icons` stores favicons locally (never hot-linked) as `public/icons/<id>.webp`; commit the new files with the outlets.

   ```sh
   pnpm catalog:health --country BR
   pnpm catalog:icons --country BR
   ```

3. Review each outlet in `data/outlets/br.json` against `docs/EDITORIAL_METHODOLOGY.md`: URL, categories, ownership with its source, pitch and `about` text. When it is right, set `"status": "verified"`, `"verified_at": "YYYY-MM-DD"` and, for an indexable profile, `about.en.reviewed: true`. Political lean or state control is only set with a `source_url`.
4. Review the country in `data/countries/br.json`: `seo_context.en` (summary, FAQ, category intros), `press_freedom` (RSF index and year), then `seo_context.en.reviewed: true` with `reviewed_at`.
5. Publish: `"published": true`. The build refuses it unless the country has at least 15 verified outlets in at least 4 categories and a reviewed `seo_context.en` (category pages need 5 verified outlets and a reviewed intro; SPEC §3.5).
6. `pnpm catalog:validate && pnpm catalog:report`, commit, push. CI checks it; the merge to `main` deploys to GitHub Pages.

`pnpm catalog:report` shows, per country, verified vs candidate outlets and coverage per category.

## Brand

The two sources live in `docs/brand/`: `logo.webp` (symbol and name) and `symbol.webp` (symbol only), both on white. `pnpm brand:assets` regenerates what the site uses from them: `public/favicon.ico`, `public/apple-touch-icon.png`, `public/mark.webp` (header) and `public/og.png` (the 1200×630 image shown when a page is shared). Commit the outputs after changing a source.

## Corrections and suggestions

Readers report errors and suggest outlets through the issue forms in `.github/ISSUE_TEMPLATE/`: outlet pages prefill the outlet, category columns prefill the country and category (`src/lib/issues.ts`). Review each issue against `docs/EDITORIAL_METHODOLOGY.md`; an accepted suggestion becomes a `candidate` with `pnpm catalog:add`, and an accepted correction is a commit to `data/outlets/` that references the issue. People without a GitHub account write to the contact address in `data/site.json`.

## Countries and locales

- New country: add `data/countries/<iso2>.json` (copy an existing one; `published: false`, `press_freedom: null` until you fill it) and an empty `data/outlets/<iso2>.json` (`[]`), then follow the catalog flow above. `pnpm catalog:validate` lists any missing field. The launch list is `data/launch-countries.json`.
- Languages: English at the root and Brazilian Portuguese under `/pt/` (`ENABLED_LOCALES=en,pt`). Interface copy lives in `src/lib/i18n/` (`ui.ts`, `labels.ts`), catalog copy in each country's `name`/`seo_context` and each outlet's `pitch`; `catalog:validate` fails on any missing translation for an enabled locale. Pages live under `src/pages/[...lang]/` and are built once per language. Adding `es`, `fr` or `de` follows the same path; see `docs/SEO_PLAYBOOK.md`.

## Open work (owner)

Nothing here blocks the deploy; the site went live first and is reviewed after (state on 2026-11-11):

- **Re-check the published outlets one by one.** The 753 outlets of the 31 published countries were approved in bulk on 2026-10-27, without the per-outlet check of `docs/EDITORIAL_METHODOLOGY.md`. None has `about.en.reviewed: true` yet, so every outlet profile stays `noindex` until it is reviewed.
- **9 countries still unpublished** (BZ, EG, GT, HN, KE, NI, PA, PK, SV): 140 `candidate` outlets to verify; publish each country once it reaches the thresholds and its `seo_context` is reviewed.
- **Press freedom:** `press_freedom` is empty in every country; fill it from the RSF index.
- **Legal pages:** read privacy, terms, independence and methodology, then set `legal_reviewed: true` in `data/site.json`. Contact (`newsmapp@atomicmail.io`) and governing law (Brazil) are set.
- **License:** choose a `LICENSE` for the code and one for the catalog data; without it, nobody may reuse them.
- **Search:** register `https://newsmapp.github.io/` in Search Console and Bing Webmaster Tools and submit the sitemap.
