# SEO Playbook

How NewsMap earns organic traffic without tripping scaled-content policies. Decisions behind it: ADR 0003, 0006, 0010.

## Canonical URLs

| Page             | URL                                                                                                 | Indexed when                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Home             | `/`                                                                                                 | always                                                                      |
| Continent hub    | `/continent/[continent]/`                                                                           | ≥ 3 published countries in it (counting `also_in`)                          |
| Country          | `/[country]/`                                                                                       | published (≥ 15 verified outlets in ≥ 4 categories, reviewed summary)       |
| Country category | `/[country]/[category]/`                                                                            | ≥ 5 verified outlets in the category and a reviewed intro                   |
| Outlet profile   | `/[country]/outlet/[outlet]/`                                                                       | generated for every verified outlet; indexable only with a reviewed `about` |
| Institutional    | `/about/`, `/methodology/`, `/corrections/`, `/disclosures/`, `/privacy/`, `/terms/`, `/advertise/` | always                                                                      |

Rules:

- Lowercase, hyphenated slugs. **Trailing slash always**; the non-slash variant redirects (301).
- Canonical is absolute, built from `SITE_URL`, and self-referencing.
- Pages that don't meet a threshold are not generated, or render `noindex,follow`, and never appear in the sitemap.

## Titles and descriptions

- `<title>` 30–60 characters, unique per page. Pattern for countries: `Newspapers in Brazil: 34 outlets compared | NewsMap`.
- Meta description 110–160 characters stating what the page lets the reader do (compare by paywall, ownership, format).
- The SEO audit enforces both.

## Internationalization (future)

- v1.0: English at the root. `ENABLED_LOCALES=en`; no `hreflang` emitted.
- Adding a locale: enable it in `ENABLED_LOCALES`, add `seo_context.[locale]` and `pitch.[locale]` to every published country/outlet (the build fails otherwise), and pages appear under `/[locale]/…`.
- Matrix when more than one locale is enabled: every page lists all its available locale variants plus `x-default` → English, reciprocally. The audit checks reciprocity.

## Internal linking

- Breadcrumbs on every page (`Home › Continent › Country › Category`).
- Country page → published neighbors (`neighbors`).
- Category page → the same category in other countries of the same continent.
- Outlet profile → similar outlets (same country and category, same ownership type).
- Home → every published country, grouped by continent.

## Structured data

`WebSite` + `Organization` (home), `BreadcrumbList` (all inner pages), `ItemList` (country and category), `NewsMediaOrganization` (profiles), `FAQPage` (country — valid markup, no rich-result expectation). No `SearchAction`.

## Search Console routine

1. Verify the domain property; submit `/sitemap-index.xml`.
2. Weekly: Pages report (excluded/indexed ratio), Core Web Vitals, top queries per country.
3. When a country's pages are "Crawled – currently not indexed", improve its summary and category intros before adding more pages.

## Badges and outreach

1. Every verified outlet profile shows a copyable badge snippet with brand-only anchor text.
2. Outreach is manual: e-mail the outlet's audience or partnerships contact once the country is published, with the profile URL and snippet. No incentives for linking.
3. Track adoption with the referrer report in the admin.
