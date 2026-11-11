# Catalog maintenance

How the directory's data is added, reviewed and published. The rules behind each decision are in [`EDITORIAL_METHODOLOGY.md`](EDITORIAL_METHODOLOGY.md).

## From draft to published

Git is the CMS: every outlet and country is a JSON file in `data/`, validated by the Zod schemas in `src/schemas/`. Tools only ever create `candidate` outlets; only the owner marks an outlet `verified` or a country `published`.

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
5. Publish: `"published": true`. The build refuses it unless the country has at least 15 verified outlets in at least 4 categories and a reviewed `seo_context.en` (category pages need 5 verified outlets and a reviewed intro; see `src/lib/catalog/thresholds.ts`).
6. `pnpm catalog:validate && pnpm catalog:report`, commit, push. CI checks it; the merge to `main` deploys to GitHub Pages.

`pnpm catalog:report` shows, per country, verified vs candidate outlets and coverage per category.

## Handling corrections and suggestions

Readers report errors and suggest outlets through the issue forms in `.github/ISSUE_TEMPLATE/`: outlet pages prefill the outlet, category columns prefill the country and category (`src/lib/issues.ts`). Review each issue against `docs/EDITORIAL_METHODOLOGY.md`; an accepted suggestion becomes a `candidate` with `pnpm catalog:add`, and an accepted correction is a commit to `data/outlets/` that references the issue. People without a GitHub account write to the contact address in `data/site.json`.

## Countries and locales

- New country: add `data/countries/<iso2>.json` (copy an existing one; `published: false`, `press_freedom: null` until you fill it) and an empty `data/outlets/<iso2>.json` (`[]`), then follow the catalog flow above. `pnpm catalog:validate` lists any missing field. The launch list is `data/launch-countries.json`.
- Languages: English at the root and Brazilian Portuguese under `/pt/` (`ENABLED_LOCALES=en,pt`). Interface copy lives in `src/lib/i18n/` (`ui.ts`, `labels.ts`), catalog copy in each country's `name`/`seo_context` and each outlet's `pitch`; `catalog:validate` fails on any missing translation for an enabled locale. Pages live under `src/pages/[...lang]/` and are built once per language. Adding `es`, `fr` or `de` follows the same path; see `docs/SEO_PLAYBOOK.md`.

## Brand

The two sources live in `docs/brand/`: `logo.webp` (symbol and name) and `symbol.webp` (symbol only), both on white. `pnpm brand:assets` regenerates what the site uses from them: `public/favicon.ico`, `public/apple-touch-icon.png`, `public/mark.webp` (header) and `public/og.png` (the 1200×630 image shown when a page is shared). Commit the outputs after changing a source.
