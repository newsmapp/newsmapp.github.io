# Cloudflare configuration

What lives where (ADR 0007, ADR 0008):

| Concern                                         | Source of truth                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| Worker, D1, Analytics Engine, rate limits, cron | `wrangler.jsonc` at the repo root (commented; Wrangler reads JSONC, not TOML) |
| Static security and cache headers               | `public/_headers`                                                             |
| Dynamic security headers                        | `src/middleware.ts`                                                           |
| Cache Rules, WAF rate limit, Bot Fight Mode     | `setup-zone.sh` (this folder)                                                 |
| Cloudflare Access for `/admin*`, `/api/admin/*` | `setup-zone.sh` (or the dashboard steps below)                                |
| Secrets                                         | `wrangler secret put` only; inventory in `docs/runbooks/deploy.md`            |

## setup-zone.sh

Idempotent: it replaces the zone's cache-settings and rate-limit entry-point rulesets and updates the Access application named `NewsMapp admin` if it exists. Preview the payloads first:

```sh
DRY_RUN=1 DOMAIN=example.com ./deploy/cloudflare/setup-zone.sh
```

Then apply (prompts for a temporary token, see the script header for its permissions):

```sh
ZONE_ID=... ACCOUNT_ID=... DOMAIN=example.com ADMIN_EMAIL=you@example.com ./deploy/cloudflare/setup-zone.sh
```

The cache-settings and rate-limit entry points are replaced as a whole: if you add other rules there by hand, add them to the script too or they will be removed on the next run.

## Dashboard equivalent

- Caching → Cache Rules → Create: "Bypass dynamic" when URI Path starts with `/api/` OR `/go/` OR `/admin`, Cache eligibility: Bypass cache.
- Security → WAF → Rate limiting rules: URI Path starts with `/api/` AND does not start with `/api/webhooks/`; same IP and colo; 30 requests / 10 seconds; Block for 10 seconds.
- Security → Bots → Bot Fight Mode: On.
- Zero Trust → Access → Applications → Add → Self-hosted: domain `example.com`, paths `admin` and `api/admin`; policy Allow, Include Emails = the owner. Copy the Application Audience (AUD) tag into `wrangler secret put CF_ACCESS_AUD`.

## Known interaction

Bot Fight Mode cannot be bypassed by WAF skip rules on the free plan and may challenge server-to-server calls. After enabling it, send a test webhook from LemonSqueezy and confirm it returns 200 (`docs/runbooks/deploy.md`, step "Webhooks"). If deliveries are challenged, turn Bot Fight Mode off: Turnstile, the WAF rule and the Worker rate limits still protect the forms.
