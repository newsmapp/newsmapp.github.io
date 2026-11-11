# NewsMapp — contributor guide

Global news directory: a free, non-commercial, fully static Astro site on GitHub Pages (ADR 0014). `SPEC.md` (the owner's local copy, not versioned) is the source of truth except where ADR 0014 overrides its revenue sections; decisions live in `docs/adr/`.

## Commands

| Task                        | Command                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| Everything a PR must pass   | `pnpm check`                                                         |
| Dev server                  | `pnpm dev`                                                           |
| Unit tests / coverage       | `pnpm test` / `pnpm test:coverage`                                   |
| E2E + accessibility         | `pnpm e2e` / `pnpm a11y`                                             |
| Build (site + search index) | `pnpm build`, then `pnpm preview` to serve `dist/` like GitHub Pages |
| Brand files from docs/brand | `pnpm brand:assets`                                                  |
| Catalog tooling             | `pnpm catalog:<validate\|health\|draft\|import\|add\|icons\|report>` |

`mise run check` is equivalent to `pnpm check`.

## Layout

- `data/` — the catalog (Git is the CMS). JSON validated by Zod schemas in `src/schemas/`.
- `src/lib/` — pure logic (no Astro, no UI). Most tests live here.
- `src/pages/` — routes. Everything is prerendered: there is no server. Badges, sitemaps and `robots.txt` are static files too.
- `src/components/`, `src/layouts/`, `src/styles/` — UI.
- `tools/` — CLIs run with `tsx` (catalog, audits, the local static server). Never imported by `src/`.
- `.github/ISSUE_TEMPLATE/` — the correction and suggestion forms the site links to (`src/lib/issues.ts`).

Boundaries are enforced by dependency-cruiser (`.dependency-cruiser.cjs`).

## Rules

- The repository is public. Never commit secrets, personal data or anything private; the site needs no secrets at all.
- Only the owner marks an outlet `verified` or a country `published`. Tools may draft `candidate` outlets only.
- The site makes no money: no ads, sponsored listings, affiliate links or tracking (ADR 0014). Outbound links are plain `href`s.
- No server-side code, forms, cookies or analytics. No third-party scripts, fonts or images at runtime.
- Every internal link is root-relative: the site is served from the root of its origin, never from a `/<repo>/` path.
- Run `pnpm check` before committing. Conventional Commits, one logical change per commit.
- Commits and PRs carry no tool attribution: no `Co-Authored-By` trailers, no "generated with" lines, no e-mails or local paths. Never use `git add -A` blindly; stage explicit paths.
- Node 24 (`nvm use 24`): dependency-cruiser rejects Node 25.
