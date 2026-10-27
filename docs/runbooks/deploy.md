# Deploy runbook

How to take NewsMapp from this repository to production on Cloudflare (ADR 0008). No secret values live here: only variable names, where to get them and how to set them. Any manual change made in production must be written back into this file.

Commands prefixed with `!` need your Cloudflare or GitHub login: run them yourself in the terminal. Secrets are always typed into a hidden prompt (`wrangler secret put`, `gh secret set`), never pasted into chat, issues, commits or files.

## 1. Status

Done and verified locally (2026-10-27):

| Item                                                                                                       | Evidence                                                                         |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Format, lint, boundaries, types, catalog validation, 146 unit tests                                        | `pnpm check` exit 0                                                              |
| Production catalog build and SEO audit                                                                     | `pnpm build && pnpm seo:audit`: 9 pages, 8 sitemap URLs, 0 findings              |
| Fixture build, E2E and accessibility (axe) on the real Worker with local D1                                | `pnpm e2e`: 38/38                                                                |
| Lighthouse budgets on 4 page types (LCP ≤ 1.8 s, CLS ≤ 0.01, TBT ≤ 100 ms, JS ≤ 35 KB, a11y and SEO = 100) | `pnpm lhci` exit 0, CLS 0 on all 12 runs, LCP 1.36–1.68 s                        |
| Worker bundle and bindings                                                                                 | `wrangler deploy --dry-run`: 276 KiB gzip, D1, Analytics Engine, 2 rate limiters |
| Workflows (`ci.yml`, `deploy.yml`, `scheduled.yml`) and `setup-zone.sh`                                    | `actionlint` and `shellcheck` clean; `setup-zone.sh` dry run prints payloads     |

Done but not verified (needs your accounts):

- The workflows have never run on GitHub; the first push is their first run.
- `setup-zone.sh` has not been applied to a real zone; Cloudflare may reject a field if the free-plan limits changed.
- The Analytics Engine SQL used by the admin click report (`src/server/analytics.ts`) is untested against the real dataset.
- Bot Fight Mode vs LemonSqueezy webhooks (see `deploy/cloudflare/README.md`).

Pending on the owner: everything in §4 marked "owner", plus the content gates in §5.

Known limitations at launch:

- No country is `published` yet, so the production build has only the home, legal pages and hubs. That is the intended state until outlets are verified.
- Without LemonSqueezy keys the Worker runs checkout in simulation mode: a form submission reserves a slot without payment until the reservation expires. Do not link `/advertise/` publicly before step 4.11.
- Preview versions (`wrangler versions upload`) share the production D1 database and secrets.

## 2. Accounts and costs

| Service                                          | Why                                                       | Plan                                       | Expected monthly cost                      | Link                                           |
| ------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------ | ------------------------------------------ | ---------------------------------------------- |
| Domain registrar (Cloudflare Registrar or other) | The site's domain                                         | —                                          | ≈ US$ 1 (US$ 10–15/year)                   | https://www.cloudflare.com/products/registrar/ |
| Cloudflare                                       | Workers, D1, Analytics Engine, R2, Turnstile, Access, WAF | Free; Workers Paid if needed               | US$ 0; US$ 5 once over free Workers limits | https://dash.cloudflare.com/                   |
| GitHub                                           | Repository, CI/CD, scheduled jobs                         | Free (private repo: 2,000 Actions minutes) | US$ 0                                      | https://github.com/                            |
| LemonSqueezy                                     | Merchant of record for sponsorships (ADR 0013)            | No monthly fee                             | 5% + US$ 0.50 per transaction              | https://www.lemonsqueezy.com/                  |
| Affiliate programs                               | R2 revenue                                                | Free                                       | US$ 0                                      | per program                                    |

Total: about US$ 1/month (the domain) at launch. Costs rise with traffic past the free Workers limit (100,000 requests/day; static assets are free and unlimited), D1 past 5 GB, or R2 past 10 GB (weekly gzip exports are tiny). Cloudflare Access is free up to 50 users.

## 3. Secrets and configuration inventory

Worker secrets (production), set with `! pnpm exec wrangler secret put NAME`:

| Name                          | Purpose                                                        | Where to obtain                                                                                                     | First deploy?        |
| ----------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `VISITOR_HASH_SECRET`         | Daily-salted visitor hash for click analytics                  | Generate: `openssl rand -hex 32 \| pnpm exec wrangler secret put VISITOR_HASH_SECRET`                               | Required             |
| `TURNSTILE_SECRET_KEY`        | Server-side Turnstile validation                               | Dashboard → Turnstile → your widget                                                                                 | Required             |
| `CF_ACCESS_TEAM_DOMAIN`       | Access JWT issuer (`<team>.cloudflareaccess.com`)              | Zero Trust → Settings → Custom pages (team domain)                                                                  | Required (admin)     |
| `CF_ACCESS_AUD`               | Access application audience tag                                | Printed by `setup-zone.sh`, or Zero Trust → Access → Applications → Overview                                        | Required (admin)     |
| `GITHUB_DISPATCH_TOKEN`       | Lets the Worker trigger `deploy.yml` after sponsorship changes | GitHub → Settings → Developer settings → Fine-grained token: this repo only, Actions: Read and write, 1-year expiry | Before selling slots |
| `LEMONSQUEEZY_API_KEY`        | Create checkouts                                               | LemonSqueezy → Settings → API (test mode first)                                                                     | Before selling slots |
| `LEMONSQUEEZY_STORE_ID`       | Store for checkouts                                            | LemonSqueezy → Settings → Stores                                                                                    | Before selling slots |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Verifies webhook signatures                                    | You choose it when creating the webhook (step 4.11)                                                                 | Before selling slots |
| `CLOUDFLARE_ANALYTICS_TOKEN`  | Admin click reports (Analytics Engine SQL)                     | API token: Account → Account Analytics: Read                                                                        | Optional             |

Never set `ADMIN_DEV_BYPASS` in production; it only works on localhost anyway.

GitHub Actions secrets, set with `! gh secret set NAME` (prompts for the value):

| Name                       | Purpose                                        | Token permissions (Cloudflare → My Profile → API Tokens → Create custom token)                                           |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `CLOUDFLARE_ACCOUNT_ID`    | Account for every job                          | Not a token: Dashboard → Workers & Pages → Account ID                                                                    |
| `CLOUDFLARE_API_TOKEN`     | `deploy.yml`: migrations and `wrangler deploy` | Start from the "Edit Cloudflare Workers" template, add Account → D1: Edit, and limit Account and Zone resources to yours |
| `CLOUDFLARE_D1_READ_TOKEN` | Sponsorship snapshot at build time             | Account → D1: Read                                                                                                       |
| `CLOUDFLARE_BACKUP_TOKEN`  | Weekly D1 export to R2                         | Account → D1: Edit, Workers R2 Storage: Edit                                                                             |

GitHub Actions variables (public), set with `gh variable set NAME --body VALUE`:

| Name                 | Value                                                  |
| -------------------- | ------------------------------------------------------ |
| `SITE_URL`           | `https://your-domain` (no trailing slash)              |
| `TURNSTILE_SITE_KEY` | The widget's site key (public by design)               |
| `ENABLED_LOCALES`    | Optional, default `en`                                 |
| `ADS_ENABLED`        | Optional, default `false` (see README before changing) |

Committed configuration (not secret): `database_id` and `GITHUB_REPOSITORY` in `wrangler.jsonc`, `data/site.json`, `data/monetization/*.json`.

## 4. Steps, in order

Estimated total: 60–90 minutes the first time, excluding DNS propagation and LemonSqueezy store approval.

### 4.1 Accounts and 2FA (owner, 15 min)

- Goal: Cloudflare and GitHub accounts protected by 2FA.
- Where: Cloudflare → My Profile → Authentication; GitHub → Settings → Password and authentication.
- Action: enable 2FA (security key or TOTP) and store the recovery codes offline.
- Verify: both pages show 2FA "enabled".

### 4.2 Repository on GitHub (owner, 5 min)

- Goal: the code on a private GitHub repository with `main` protected.
- Action: `! gh repo create newsmap --private --source . --push`, then Settings → Branches → add a rule for `main`: require the `CI` checks (`check`, `e2e`) to pass. Settings → Environments → create `production` (optionally require your approval).
- Then commit your repository name: in `wrangler.jsonc` set `"GITHUB_REPOSITORY": "<user>/newsmap"`.
- Verify: the Actions tab shows a `CI` run for the push; it must be green.
- If it fails: open the run; the `e2e-reports` artifact holds the Playwright and Lighthouse reports.

### 4.3 Wrangler login (owner, 2 min)

- Action: `! pnpm exec wrangler login` (opens the browser), then `! pnpm exec wrangler whoami`.
- Verify: `whoami` prints your account name and ID.

### 4.4 Create D1 and apply migrations (agent or owner, 5 min)

- Action: `! pnpm exec wrangler d1 create newsmap`. Copy the printed `database_id` into `wrangler.jsonc` (replace the zeros) and commit it. Then `! pnpm db:migrate:remote`.
- Verify: `! pnpm exec wrangler d1 execute newsmap --remote --command "SELECT name FROM sqlite_master WHERE type='table'"` lists the tables from `drizzle/migrations/`.
- If it fails: "database not found" means the id in `wrangler.jsonc` does not match.

### 4.5 R2 bucket for backups (owner, 3 min)

- Action: `! pnpm exec wrangler r2 bucket create newsmap-backups`, then Dashboard → R2 → `newsmap-backups` → Settings → Object lifecycle rules → delete objects with prefix `d1/` after 90 days.
- Verify: `! pnpm exec wrangler r2 bucket list` shows the bucket.

### 4.6 Turnstile widget (owner, 3 min)

- Where: Dashboard → Turnstile → Add widget. Hostnames: your domain and `newsmap.<subdomain>.workers.dev`. Mode: Managed.
- Action: set the secret with `! pnpm exec wrangler secret put TURNSTILE_SECRET_KEY`; keep the site key for 4.8.
- Verify: `! pnpm exec wrangler secret list` shows `TURNSTILE_SECRET_KEY`.

### 4.7 Remaining Worker secrets (owner, 5 min)

- Action: `VISITOR_HASH_SECRET` as in §3. `CF_ACCESS_*` come in 4.10; LemonSqueezy in 4.11; `GITHUB_DISPATCH_TOKEN` once the repository exists.
- Verify: `wrangler secret list` shows the names (never the values).

### 4.8 First deploy to workers.dev = preview (agent + owner, 10 min)

- Goal: the site running on `newsmap.<subdomain>.workers.dev` before any domain or real user.
- Action: create the API tokens and set the GitHub secrets and variables of §3 (`SITE_URL` can be the workers.dev URL for now). Then Actions → Deploy → Run workflow, reason `first deploy`.
- Smoke test (agent can run these once you share the URL):

  ```sh
  BASE=https://newsmap.<subdomain>.workers.dev
  curl -sI "$BASE/" | grep -iE '^(HTTP|content-security-policy|strict-transport|x-frame)'
  curl -s "$BASE/api/geo/"                                     # {"country":"BR"} or similar
  curl -s "$BASE/api/slots/?country=US&category=general-news"  # {"available":3,"total":3}: D1 works
  curl -sI "$BASE/admin/" | head -1                            # 403 until Access is configured
  curl -s "$BASE/sitemap-index.xml" | head -5
  ```

- If `/api/slots/` returns 500: migrations missing (4.4) or wrong `database_id`.

### 4.9 Domain, DNS and TLS (owner, 10 min + propagation)

- Action: add the domain to Cloudflare (Dashboard → Add a domain, Free plan) and point the registrar's nameservers to the two Cloudflare nameservers shown. Then Workers & Pages → `newsmap` → Settings → Domains & Routes → Add → Custom domain → `your-domain` (and `www` if wanted). SSL/TLS → Edge Certificates: Always Use HTTPS on, minimum TLS 1.2.
- Update the `SITE_URL` variable to `https://your-domain` and re-run Deploy (canonicals and sitemaps use it). `wrangler.jsonc` declares no routes, so `wrangler deploy` keeps the custom domain added in the dashboard; if you prefer it in code, add `"routes": [{ "pattern": "your-domain", "custom_domain": true }]`.
- Verify: `dig +short NS your-domain` shows Cloudflare; `curl -sI https://your-domain/` returns `200` with `strict-transport-security`.

### 4.10 Zone rules and Cloudflare Access (owner, 10 min)

- Action: in Zero Trust, pick a team name (free plan) and add an identity method (One-time PIN by e-mail is enough). Then run `deploy/cloudflare/setup-zone.sh` as documented in `deploy/cloudflare/README.md`, and set the two printed secrets (`CF_ACCESS_AUD`, `CF_ACCESS_TEAM_DOMAIN`).
- Verify: `curl -sI https://your-domain/admin/` redirects to `<team>.cloudflareaccess.com`; in a browser, logging in with your e-mail opens the admin. `curl -sI https://your-domain/api/admin/export/` also redirects. Twenty quick `curl` calls to `/api/geo/` should eventually return 429 from the WAF rule.
- If the admin returns 403 after login: the AUD or team domain secret does not match the application.

### 4.11 LemonSqueezy in test mode, webhook (owner, 20 min)

- Action: create the store, one product with monthly and yearly variants per price tier, and write their `variant_ids` into `data/monetization/pricing.json` (commit). Settings → Webhooks → add `https://your-domain/api/webhooks/lemonsqueezy/` (the trailing slash matters), choose a signing secret, and select `subscription_created`, `subscription_updated`, `subscription_payment_success`, `subscription_payment_failed`, `subscription_cancelled`, `subscription_expired`, `order_refunded`. Set `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET` and `GITHUB_DISPATCH_TOKEN` as Worker secrets.
- Verify: on `/advertise/`, buy a slot with a test card; LemonSqueezy → Webhooks shows each delivery with response `200`; the admin lists the sponsorship as active; a Deploy run with reason starting "sponsorship" appears in Actions and, after it, the sponsor shows on the page. Then cancel, let a payment fail and refund in test mode, checking the status in the admin each time.
- If deliveries fail with 403/challenge: Bot Fight Mode, see `deploy/cloudflare/README.md`. With 401: the webhook secret differs.

### 4.12 Backups and monitoring (owner, 15 min)

- Backup: Actions → Scheduled → Run workflow → `backup`. Verify the object in R2 → `newsmap-backups/d1/`.
- Restore test (do it once now):

  ```sh
  ! pnpm exec wrangler r2 object get newsmap-backups/d1/newsmap-<date>.sql.gz --file restore.sql.gz --remote
  gunzip restore.sql.gz
  ! pnpm exec wrangler d1 create newsmap-restore-test
  ! pnpm exec wrangler d1 execute newsmap-restore-test --remote --file restore.sql
  ! pnpm exec wrangler d1 execute newsmap-restore-test --remote --command "SELECT count(*) FROM sponsorships"
  ! pnpm exec wrangler d1 delete newsmap-restore-test
  rm restore.sql
  ```

- Monitoring: Notifications → add "Workers: error rate" (or weekly usage) to your e-mail; add an uptime check on `https://your-domain/` and `https://your-domain/api/geo/` (Cloudflare Health Checks need Pro; a free external monitor such as UptimeRobot works). Worker logs: Workers & Pages → `newsmap` → Logs (observability is enabled in `wrangler.jsonc`).
- Billing: Manage Account → Billing → set a budget alert if you move to Workers Paid.

### 4.13 Live payments (owner, after legal approval)

- Action: switch LemonSqueezy to live mode, replace `LEMONSQUEEZY_API_KEY` and `LEMONSQUEEZY_WEBHOOK_SECRET` with the live values (create a live webhook with the same URL and events), update live `variant_ids` in `pricing.json`.
- Verify: one real purchase, then refund it; both events arrive with `200`.

### 4.14 Search registration (owner, 10 min)

- Action: Google Search Console → add the domain property (DNS TXT record in Cloudflare DNS) → Sitemaps → submit `https://your-domain/sitemap-index.xml`. Same in Bing Webmaster Tools (import from Search Console).
- Verify: the sitemap status shows "Success".

## 5. Go-live checklist

- [ ] 2FA on registrar, Cloudflare, GitHub, LemonSqueezy and the e-mail account; recovery codes offline.
- [ ] One API token per purpose with the permissions in §3; no Global API Key anywhere; the `setup-zone.sh` token deleted.
- [ ] `main` protected; deploy only through `deploy.yml`.
- [ ] workers.dev smoke test (4.8) passed before attaching the domain.
- [ ] Weekly backup ran and one restore was tested (4.12).
- [ ] Uptime check and error alert reach you.
- [ ] LemonSqueezy test cycle complete: purchase, renewal (or simulated `subscription_payment_success`), failure, cancellation, refund.
- [ ] `curl -sI https://your-domain/` shows HSTS, CSP, `x-frame-options`; `/admin/` is behind Access.
- [ ] Legal pages (privacy, terms, disclosures, methodology) and `data/site.json` approved, `legal_reviewed: true`.
- [ ] Countries published only after the verification thresholds (SPEC §3.5).
- [ ] Rollback rehearsed once (§6).

## 6. Rollback

- Code: `! pnpm exec wrangler deployments list` then `! pnpm exec wrangler rollback <version-id>` returns the Worker and its static assets to that version immediately. Afterwards `git revert` the bad commit on `main` so the next deploy does not bring it back.
- Rehearsal: roll back to the previous version, check the site, then re-run Deploy to return to the latest.
- Database: migrations are forward-only. A bad migration is fixed with a new migration. For data loss, D1 Time Travel restores to any minute in the last 30 days: `! pnpm exec wrangler d1 time-travel restore newsmap --timestamp <ISO-8601>` (this overwrites the current data; export first). The weekly R2 export is the fallback beyond that window.
- Emergency switches: disable the LemonSqueezy webhook or put the store in test mode (stops activations); delete `GITHUB_DISPATCH_TOKEN` (stops sponsor-triggered rebuilds); set `ADS_ENABLED=false` and redeploy; Security → Settings → "Under Attack" mode for abusive traffic.

## 7. After launch

- First 24 hours: watch Worker logs and error rate, the first webhook deliveries and the admin's click counts (this also validates the Analytics Engine SQL).
- First week: Search Console coverage and sitemap; Core Web Vitals in the field (Search Console → Experience); review the first weekly `catalog-health` issue.
- Recurring: weekly health issue and backup (automatic); monthly dependency updates through a PR (CI must pass) and a cost check; quarterly restore test; yearly rotation of `GITHUB_DISPATCH_TOKEN`, the Cloudflare tokens and `VISITOR_HASH_SECRET`, plus the LemonSqueezy webhook secret.
