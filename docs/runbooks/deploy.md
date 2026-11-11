# Deploy runbook

How to publish NewsMapp for free at **https://newsmapp.github.io/**, from the repository `newsmapp/newsmapp.github.io` of the GitHub Organization `newsmapp` (ADR 0014). The site is fully static: no server, no database, no secrets. Any manual change made in the GitHub settings must be written back into this file.

Commands prefixed with `!` need your GitHub login: run them yourself in the terminal.

## 1. Status

Done and verified locally (2026-11-11, English and Brazilian Portuguese):

| Item                                                                                                       | Evidence                                                                        |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Format, lint, boundaries, types, catalog validation, unit tests with coverage                              | `pnpm check` and `pnpm test:coverage` exit 0                                    |
| Production catalog build and SEO audit (badges and sitemaps included, every internal link a built file)    | `pnpm build && pnpm seo:audit`: 1,738 pages, 232 sitemap URLs, 0 findings       |
| Fixture build, E2E and accessibility (axe), served the way GitHub Pages serves files                       | `pnpm e2e`: 46/46                                                               |
| Lighthouse budgets on 4 page types (LCP ≤ 1.8 s, CLS ≤ 0.01, TBT ≤ 100 ms, JS ≤ 35 KB, a11y and SEO = 100) | `pnpm lhci`: all assertions passed                                              |
| Actions pinned by SHA, Pages actions included                                                              | `configure-pages` v6.0.0, `upload-pages-artifact` v5.0.0, `deploy-pages` v5.0.1 |

Done but not verified (needs your accounts):

- The workflows have never run on GitHub; the first push to the organization's repository is their first run.
- The issue forms (`.github/ISSUE_TEMPLATE/`) render only on GitHub; check them once (4.5).

Known limitations:

- 31 countries and 753 outlets were published on 2026-10-27 by the owner's decision to launch first and review after: the drafted outlets were marked `verified` in bulk, without the per-outlet check of `docs/EDITORIAL_METHODOLOGY.md`, and the country texts as `reviewed`. Review them country by country and fix or retire what is wrong. Outlet profiles stay `noindex` until their `about.en.reviewed` is true.
- GitHub Pages sends no custom headers: no `frame-ancestors`/`X-Frame-Options`, no `Permissions-Policy`, and cache lifetimes are GitHub's (10 minutes). The CSP is a `<meta>` tag (ADR 0014).

## 2. Accounts and costs

| Service          | Why                                                | Plan                                                  | Monthly cost | Link                |
| ---------------- | -------------------------------------------------- | ----------------------------------------------------- | ------------ | ------------------- |
| GitHub           | Organization, public repository, CI, Pages, issues | Free (public repositories: unlimited Actions minutes) | US$ 0        | https://github.com/ |
| Domain, optional | A custom domain instead of `newsmapp.github.io`    | Any registrar                                         | ≈ US$ 1      | —                   |

Total: US$ 0 with `newsmapp.github.io`. GitHub Pages limits: published site ≤ 1 GB, soft limit of 100 GB bandwidth per month and 10 builds per hour.

## 3. Configuration inventory

No secrets. Optional repository variables (Settings → Secrets and variables → Actions → Variables):

| Name              | Purpose                                            | Default                                               |
| ----------------- | -------------------------------------------------- | ----------------------------------------------------- |
| `SITE_URL`        | Origin for canonicals, sitemaps and badge snippets | The Pages URL GitHub reports (custom domain included) |
| `ENABLED_LOCALES` | Languages built                                    | `en,pt`                                               |

`GITHUB_REPOSITORY` (set by Actions on every run) gives the links to the code and to the issue forms.

The site must be served from the root of its origin (ADR 0014), which is why the repository is named `newsmapp.github.io`. A project site such as `https://newsmapp.github.io/<repo>/` fails the build on purpose.

## 4. Steps

### 4.1 Organization (owner, 5 min)

- Action: github.com → your avatar → Your organizations → New organization → Free plan, name `newsmapp`. Organization settings → Authentication security → require two-factor authentication.
- Verify: the organization page opens and lists you as owner.

### 4.2 Repository (owner, 5 min)

- Action: create the **public** repository `newsmapp.github.io` in the organization (no README, no license: this repository brings its own history). Then push this repository to it:

  ```sh
  ! git remote add origin git@github.com:newsmapp/newsmapp.github.io.git
  ! git push -u origin main
  ```

- Before the first push, check that nothing private is in the history: `git log --all --stat` and `git grep -nI -e '@' -e 'token' -e 'secret'`. Once public, everything committed is public forever.
- Verify: the repository page shows the code; Actions → CI starts.

### 4.3 GitHub Pages (owner, 2 min)

- Action: repository Settings → Pages → Build and deployment → Source: **GitHub Actions**.
- Verify: Settings → Environments lists `github-pages`, limited to the default branch.

### 4.4 First deploy (owner, 5 min)

- Before: `data/site.json` holds the contact address (`newsmapp@atomicmail.io`) and the governing law (Brazil). Deploy refuses to publish if either goes back to an example value.
- Action: wait for CI to pass on `main`; Deploy starts on its own. Or run Actions → Deploy → Run workflow.
- Verify: the Deploy run shows the published URL; `curl -sI https://newsmapp.github.io/` returns `200`; `/sitemap-index.xml`, `/robots.txt`, `/pt/` and a badge such as `/badge/brazil/g1.svg` open; site search (⌘ K) finds a country.
- If "Resolve the site URL" fails: the repository name is not exactly `newsmapp.github.io`, so GitHub serves it under a `/<repo>/` path. Rename it.
- If `configure-pages` fails with "Get Pages site failed": Pages is not enabled with the GitHub Actions source (4.3).

### 4.5 Issue forms and labels (owner, 5 min)

- Action: Issues → New issue: check that "Correction" and "Outlet suggestion" appear. Create the labels they use: `! gh label create correction --repo newsmapp/newsmapp.github.io` and `! gh label create suggestion --repo newsmapp/newsmapp.github.io`.
- Verify: on the live site, an outlet page's "Report a correction" opens the form with the outlet filled in; "Suggest an outlet" under a category fills the country and category.

### 4.6 Custom domain, optional, not planned (owner, 10 min + propagation)

- Action: Organization settings → Pages → Add a domain, and add the TXT record GitHub shows (domain verification protects against takeover). Then repository Settings → Pages → Custom domain → `your-domain`; at the registrar, point the apex with `A`/`AAAA` records to GitHub's Pages addresses (listed in the GitHub docs, "Managing a custom domain") or `www` with a `CNAME` to `newsmapp.github.io`. When the certificate is issued, tick **Enforce HTTPS**.
- Set the `SITE_URL` variable to `https://your-domain` only if the Pages URL GitHub reports differs from it; then re-run Deploy.
- Verify: `dig +short your-domain` shows GitHub's addresses; `curl -sI https://your-domain/` returns `200`; the canonical in the page source uses the domain.

### 4.7 Branch protection (owner, 3 min)

- Action: Settings → Rules → Rulesets → New branch ruleset for `main`: require a pull request (or allow only you to push), require the CI status checks, block force pushes.
- Verify: a force push to `main` is refused.

### 4.8 Search registration (owner, 10 min)

- Action: Google Search Console → add the property (URL-prefix property `https://newsmapp.github.io/`, verified with the HTML tag method) → Sitemaps → submit `https://newsmapp.github.io/sitemap-index.xml`. Same in Bing Webmaster Tools (import from Search Console).
- Verify: the sitemap status shows "Success".

## 5. Go-live checklist

- [ ] 2FA required in the organization; recovery codes offline.
- [ ] Repository public, history checked for private data before the first push.
- [ ] Pages source is GitHub Actions; deploys only through `deploy.yml` after CI on `main`.
- [ ] Enforce HTTPS on; custom domain verified at the organization level, if used.
- [ ] Ruleset on `main` with required CI checks.
- [ ] Issue forms and their labels work from the live site.
- [ ] Legal pages (privacy, terms, independence, methodology) and `data/site.json` approved, `legal_reviewed: true`; contact addresses are real.
- [ ] A `LICENSE` chosen for the code and for the catalog data (the repository is public, but without a license nobody may reuse it).
- [ ] Countries published only after the verification thresholds.

## 6. Rollback

- `git revert` the bad commit on `main` and push: CI and Deploy publish the previous state in a few minutes.
- Faster, without a commit: Actions → Deploy → pick the last good run → Re-run all jobs. It rebuilds that run's commit and publishes it. The next push to `main` replaces it again.
- Take the site offline: Settings → Pages → Unpublish site.

## 7. After launch

- First week: Search Console coverage and sitemap; Core Web Vitals in the field; review the first weekly `catalog-health` issue and the first correction issues.
- Recurring: weekly health issue (automatic); monthly dependency updates through a PR (CI must pass); triage of correction and suggestion issues.
