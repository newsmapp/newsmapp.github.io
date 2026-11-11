<p align="center">
  <img src="docs/brand/logo.webp" alt="NewsMapp" width="360">
</p>

<p align="center">
  The world's news outlets, by country and topic.<br>
  <a href="https://newsmapp.github.io/"><strong>newsmapp.github.io</strong></a>
</p>

---

NewsMapp is a directory of newspapers, broadcasters and news sites around the world. Each country page lists its main outlets in eight categories, ranked by editors, and shows for every outlet whether it can be read for free, who owns it and what kind of newsroom it is.

The project is free and non-commercial. It has no ads, no sponsored listings, no affiliate links and no tracking.

## Features

- **Eight categories per country:** national news, politics, business, sports, investigative and fact-checking, tech and science, TV and radio, and regional.
- **The facts readers need before clicking:** paywall model, owner and ownership type, format, founding year, language and RSS feed.
- **Instant search** across countries and outlets (<kbd>⌘</kbd> <kbd>K</kbd>), and filters by paywall, ownership, format and name.
- **English and Brazilian Portuguese**, with the structure ready for more languages.
- **Accessible and fast:** WCAG 2.2 AA, no third-party requests, under 35 KB of JavaScript per page.
- **Badges** that listed outlets can show on their own sites.

## How it works

The catalog lives in this repository as JSON files in [`data/`](data/), one per country, validated by [Zod](https://zod.dev/) schemas at build time. Every change to an outlet is a commit, reviewed against the [editorial methodology](docs/EDITORIAL_METHODOLOGY.md).

[Astro](https://astro.build/) turns the catalog into a fully static site, and [Pagefind](https://pagefind.app/) indexes it for search. GitHub Actions builds, tests and publishes it to GitHub Pages on every change to `main`. There is no server and no database.

Corrections and outlet suggestions are submitted as [GitHub issues](https://github.com/newsmapp/newsmapp.github.io/issues/new/choose); each outlet page links to a form with the outlet already filled in.

## Getting started

Requirements: Node.js 24 and pnpm 10.

```sh
pnpm install
pnpm dev          # http://localhost:4321
```

To serve the production build the way GitHub Pages does:

```sh
pnpm build
pnpm preview
```

To work with the small test catalog instead of the full one, prefix either build with `CATALOG_DIR=tests/fixtures/catalog`.

### Scripts

| Command                 | Description                                                    |
| ----------------------- | -------------------------------------------------------------- |
| `pnpm dev`              | Development server                                             |
| `pnpm build`            | Production build with the search index                         |
| `pnpm preview`          | Serve `dist/` locally                                          |
| `pnpm check`            | Formatting, lint, architecture rules, types, catalog and tests |
| `pnpm e2e`              | End-to-end and accessibility tests (Playwright, axe)           |
| `pnpm lhci`             | Lighthouse performance and SEO budgets                         |
| `pnpm catalog:validate` | Validate the catalog                                           |
| `pnpm catalog:report`   | Coverage per country and category                              |
| `pnpm catalog:health`   | Check every outlet link and RSS feed                           |
| `pnpm brand:assets`     | Regenerate favicon and share images from `docs/brand/`         |

## Project structure

```
data/                 Catalog: countries, outlets, reference geography
src/
  pages/              Routes, built once per language
  components/         UI components
  lib/                Pure logic: catalog rules, i18n, SEO
  schemas/            Zod schemas for the catalog
public/               Icons, flags and brand files
tools/                Catalog CLI, SEO audit, local server
tests/                Unit, end-to-end and fixture catalog
docs/                 Methodology, architecture decisions, runbooks
```

## Contributing

- **Found a mistake?** Open a [correction](https://github.com/newsmapp/newsmapp.github.io/issues/new?template=correction.yml) with a source.
- **Missing an outlet?** [Suggest it](https://github.com/newsmapp/newsmapp.github.io/issues/new?template=suggestion.yml).
- **Code or catalog changes:** read [`AGENTS.md`](AGENTS.md) for the repository rules, run `pnpm check` and open a pull request. Commits follow [Conventional Commits](https://www.conventionalcommits.org/).

Without a GitHub account, write to [newsmapp@atomicmail.io](mailto:newsmapp@atomicmail.io).

## Documentation

- [Editorial methodology](docs/EDITORIAL_METHODOLOGY.md): how outlets are selected, labeled and ranked.
- [Catalog maintenance](docs/CATALOG.md): drafting, reviewing and publishing outlets and countries.
- [Architecture decisions](docs/adr/): the reasoning behind the stack and the hosting model.
- [Deploy runbook](docs/runbooks/deploy.md): publishing to GitHub Pages.
- [SEO playbook](docs/SEO_PLAYBOOK.md) and [design brief](docs/design/brief.md).

## License

No license has been chosen yet. Until one is added, all rights are reserved.

Population figures come from the [World Bank](https://data.worldbank.org/); flags are from [flag-icons](https://github.com/lipis/flag-icons) (MIT).
