# 0014. Non-commercial, fully static site on GitHub Pages

- Status: accepted
- Date: 2026-11-11
- Supersedes: 0001, 0005, 0006, 0007, 0008, 0013. Amends: 0002, 0010, 0012.

## Context

The owner decided that NewsMapp will not make money. Every on-demand part of the previous architecture existed to support revenue or to protect what revenue required: the Worker routes (`/go/*` redirects, `/api/*` forms and checkout, `/admin/*`), D1 for submissions and sponsorships, Analytics Engine for click reports sold to sponsors, LemonSqueezy for payments, Turnstile and rate limits for the forms, Cloudflare Access for the admin. Without revenue, none of it is needed, and keeping it costs money, secrets and maintenance.

The site itself was already static-first: every directory page is prerendered from the Git catalog.

## Decision

- **Hosting:** GitHub Pages, from a public repository in a GitHub Organization (free plan). The Pages source is "GitHub Actions": `deploy.yml` builds `dist/`, runs the SEO audit and publishes it with `actions/deploy-pages` after CI passes on `main`. No secrets are involved.
- **Fully static build:** Astro `output: 'static'` with no adapter. The only endpoints left (`sitemap-*.xml`, `robots.txt`, `/badge/*.svg`) are prerendered files.
- **Served from an origin root.** Internal links, icons, flags and the Pagefind index are root-relative, so the site must live at `https://<custom-domain>/` (recommended) or in the organization's `<org>.github.io` repository. A project site at `https://<org>.github.io/<repo>/` is refused at build time (`astro.config.mjs`) rather than shipped with broken links.
- **Removed:** sponsored listings, affiliate offers, display ads and `ads.txt`, `/advertise/`, payments, click tracking, the admin, D1, Analytics Engine, Turnstile, rate limits, the daily cron and the D1 backups.
- **Outbound links** are plain `href`s with `rel="noopener"`: no beacon, no redirect. Links carry `data-outlet` only so the SEO audit can prove no unverified outlet is linked.
- **Corrections and suggestions** are GitHub issue forms (`.github/ISSUE_TEMPLATE/`). Outlet pages and category columns link to them with the outlet, country and category prefilled (`src/lib/issues.ts`). People without a GitHub account can write to the contact address. The site stores nothing.
- **Badges** (ADR 0010) are generated as static SVG files for every ranked outlet on each build. The rank shown is the one of the last deploy.
- **Security headers:** GitHub Pages cannot send custom headers. The CSP stays as Astro's hash-based `<meta>` policy; `frame-ancestors`, `X-Frame-Options` and `Permissions-Policy` are no longer sent. The site has no authenticated state and no forms, so being framed carries little risk. HTTPS is enforced in the Pages settings.
- **Privacy (amends ADR 0012):** no cookies, no analytics, no personal data held by the project. GitHub, as host, receives visitors' IP addresses under its own privacy statement; issues are public and handled by GitHub. No consent banner is needed, and none will be, because ads are out of scope.
- **Catalog workflow (amends ADR 0002):** unchanged. Git stays the CMS and the Zod-validated catalog stays the single source. Nothing is stored at runtime.

## Alternatives considered

- **Keep Cloudflare Workers on the free plan.** Free too, but it keeps a second account, API tokens, secrets and a runtime to maintain for features that no longer exist.
- **Cloudflare Pages or Netlify.** They allow custom headers, but they add an account outside GitHub. Everything already lives in GitHub (code, CI, issues), and a single place is simpler for one maintainer.
- **A form backend (Formspree, a serverless function) for corrections.** It brings back a third-party script or service, spam protection and personal data storage. Issue forms are free, moderated, public and already where the catalog is edited.

## Consequences

- Hosting costs nothing and needs no secrets. Public repositories get unlimited Actions minutes, branch protection and environments on the free plan.
- The repository is public: the catalog, its history and the reviewers' notes in commits are visible to anyone. Nothing private may ever be committed.
- GitHub Pages limits apply: published sites up to 1 GB, a soft bandwidth limit of 100 GB per month and a soft limit of 10 builds per hour. The current build is far below them.
- There are no click statistics. Popularity can no longer inform rankings; ranking stays an editorial judgment (ADR 0011).
- Corrections now require a GitHub account or an e-mail, which may lower the number of reports.
- `SPEC.md` (kept locally by the owner) still describes revenue streams; where it disagrees with this ADR, this ADR wins until the spec is updated.
