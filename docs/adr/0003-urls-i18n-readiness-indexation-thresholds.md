# 0003. URL architecture, i18n readiness and indexation thresholds

- Status: accepted
- Date: 2026-10-27

## Context

Programmatic directories are exactly what search engines' "scaled content abuse" policies target. v1.0 launches in English only with 20 curated countries; more locales come later. Outlet names collide across countries ("El País" exists in Spain and Uruguay), and some countries span two continents.

## Decision

- **URLs:** `/`, `/continent/[continent]/`, `/[country]/`, `/[country]/[category]/`, `/[country]/outlet/[outlet]/`, plus institutional pages. Lowercase hyphenated slugs, trailing slash always, absolute canonicals from `SITE_URL`.
- **Continent is an attribute, not a path segment.** Transcontinental countries list extra continents in `also_in`, which only affects hubs.
- **English at the root, no prefix.** Future locales go under `/pt/`, `/es/`, `/fr/`, `/de/` with `prefixDefaultLocale: false`. The hreflang generator exists and is tested, but emits tags only when more than one locale is enabled.
- **Thresholds:** a country page requires ≥ 15 verified outlets in ≥ 4 categories and a reviewed summary; a category page requires ≥ 5 verified outlets and a reviewed intro; a profile is indexable only with a reviewed `about`; a continent hub requires ≥ 3 published countries. Pages below threshold are not generated or are `noindex,follow`.
- **Sitemap contains only indexable pages;** the SEO audit fails otherwise.

## Alternatives considered

- `/[lang]/[continent]/[country]/…` (v1 draft): deeper, breaks for transcontinental countries, and prefixes a single language for no benefit.
- Generating every country × category page: guarantees thin content.

## Consequences

- ~1,000 pages at launch instead of tens of thousands, far below the static-asset file limit.
- Adding a locale is a content task, not a routing rewrite.
- Category slugs must never collide with reserved segments (`outlet`, `continent`, `api`, `go`, `badge`, `admin`).
