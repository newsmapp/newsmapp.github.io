# NewsMapp

A global directory of news outlets, organised by country and category. Static-first Astro site on Cloudflare Workers: pages are pre-rendered from the catalog in `data/`, and a small Worker handles clicks, forms, sponsorships, badges and the admin.

- What the product must do: `SPEC.md` (source of truth, kept locally by the owner, not versioned). Why it is built this way: `docs/adr/`.
- How to contribute and the repository rules: `AGENTS.md`.
- Production deploy, step by step: `docs/runbooks/deploy.md`.

## Run it locally

Requires Node 24 (`nvm use 24`; dependency-cruiser refuses Node 25) and pnpm 10.

```sh
pnpm install
cp .env.example .dev.vars          # local-only values: Turnstile test keys, simulated checkout
pnpm db:migrate:local
pnpm dev                           # http://localhost:4321
```

The real catalog has no published country yet, so most pages only exist with the fixtures catalog:

```sh
CATALOG_DIR=tests/fixtures/catalog pnpm build && pnpm preview   # Worker + local D1 on :8787
```

`pnpm check` runs everything a commit must pass; CI (`.github/workflows/ci.yml`) also runs the builds, SEO audit, E2E with accessibility checks and Lighthouse.

## Go live on Cloudflare (about 15 minutes of clicks)

The full runbook, with verification for every step, is `docs/runbooks/deploy.md`. The short version:

1. Accounts with 2FA: Cloudflare, GitHub. Push this repository to a private GitHub repo and protect `main`.
2. `wrangler login`, then `wrangler d1 create newsmapp`; put the printed id in `wrangler.jsonc` and run `pnpm db:migrate:remote`.
3. Create a Turnstile widget and the Worker secrets with `wrangler secret put` (inventory in the runbook §3).
4. Create the three Cloudflare API tokens and set them as GitHub secrets; set the `SITE_URL` and `TURNSTILE_SITE_KEY` variables.
5. Run Actions → Deploy. Smoke-test the `*.workers.dev` URL.
6. Add your domain to Cloudflare, attach it to the Worker, update `SITE_URL`, deploy again.
7. Run `deploy/cloudflare/setup-zone.sh` for cache rules, the WAF rate limit, Bot Fight Mode and Cloudflare Access on `/admin`.
8. LemonSqueezy in test mode: products, `variant_ids` in `data/monetization/pricing.json`, webhook to `https://your-domain/api/webhooks/lemonsqueezy/`, then the three LemonSqueezy secrets. Full test cycle before live keys.

Afterwards, deploys happen on their own: every green CI run on `main`, every sponsorship change (the Worker dispatches `deploy.yml`) and a daily rebuild for expirations. Weekly jobs open a catalog link-health issue and back up D1 to R2 (`.github/workflows/scheduled.yml`).

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
6. `pnpm catalog:validate && pnpm catalog:report`, commit, push. CI checks it; the merge to `main` deploys.

`pnpm catalog:report` shows, per country, verified vs candidate outlets and coverage per category.

## Money: affiliates, sponsorships, ads

- Affiliates (R2): `data/monetization/affiliates.json`. Join each program, replace the `url`/`params` with your tracking link, set `"active": true`. Copy rules and allowed contexts are in `docs/MONETIZATION_PLAYBOOK.md`; never copy that suggests bypassing paywalls or local law. Affiliate links always go through `/go/aff-<id>/` with `rel="sponsored"`.
- Sponsored slots (R1): prices per country tier and LemonSqueezy `variant_ids` in `data/monetization/pricing.json`; sold through `/advertise/`, activated by the webhook, managed in `/admin/`.
- Display ads (R3) stay off. Turn them on only when AdSense has approved the site, Google Privacy & Messaging (TCF-certified CMP) is configured for the EEA, UK and Switzerland, and the ads CSP profile is deployed. Then add the seller lines to `data/monetization/ads.json` (published at `/ads.txt`), set the `ADS_ENABLED` repository variable to `true` and redeploy. The privacy page must be updated before that (ADR 0012).

## Countries and locales

- New country: add `data/countries/<iso2>.json` (copy an existing one; `published: false`, `press_freedom: null` until you fill it) and an empty `data/outlets/<iso2>.json` (`[]`), then follow the catalog flow above. `pnpm catalog:validate` lists any missing field. The launch list is `data/launch-countries.json`.
- Languages: English at the root and Brazilian Portuguese under `/pt/` (`ENABLED_LOCALES=en,pt`). Interface copy lives in `src/lib/i18n/` (`ui.ts`, `labels.ts`), catalog copy in each country's `name`/`seo_context` and each outlet's `pitch`; `catalog:validate` fails on any missing translation for an enabled locale. Pages live under `src/pages/[...lang]/` and are built once per language. Adding `es`, `fr` or `de` follows the same path; see `docs/SEO_PLAYBOOK.md`.

## Before launch: your decisions

These are deliberately left to you and block the launch definition of done (SPEC §5.2):

- Verify the candidate outlets of the 40 drafted countries and publish the countries that reach the thresholds.
- Review the drafted `seo_context` texts and FAQs; fill `press_freedom` from RSF.
- Approve the methodology, privacy, terms and disclosure pages and the data in `data/site.json` (set `legal_reviewed: true`).
- Real keys, affiliate IDs and LemonSqueezy `variant_ids`; one real payment made and refunded.
- Search Console set up and the sitemap submitted.
