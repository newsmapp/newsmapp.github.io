# Design brief and plan

## Brief

1. **Who and what task.** A reader who wants the main news sources of one country, sorted by topic, and wants to know before clicking which ones are free, who owns them and whether they are TV, radio or print. Secondary: an outlet owner checking how their listing looks.
2. **Real content.** 15–35 outlets per country across 8 fixed categories. Names run from 2 characters ("AS") to 45 ("Mexicanos contra la Corrupción y la Impunidad"). Every row carries a rank, a paywall model, sometimes an ownership tag and a format.
3. **The single most important element.** The category columns with ranked outlet rows. Everything else (summary, FAQ, neighbors) is below them.
4. **The subject's world.** Reference directories and timetables: a numbered index, short status codes, tabular figures, small-format sans used by newspapers for their own furniture (bylines, tables, captions).
5. **Density and scene.** Used in short visits, often on a phone, in any light. Dense rows (42 px) on desktop; one column with anchor tabs on mobile. Light or dark follows the system, with a persisted toggle.

Mode: **Operate** for directory pages, **Read** for methodology and profile prose. Nothing persuades: the site sells nothing (ADR 0014).

## Plan

### Color (OKLCH, both themes composed separately)

| Role        | Paper Light                           | Terminal Dark                  | Job                          |
| ----------- | ------------------------------------- | ------------------------------ | ---------------------------- |
| `--canvas`  | newsprint `oklch(0.975 0.004 95)`     | slate `oklch(0.205 0.012 250)` | page                         |
| `--surface` | `oklch(0.995 0.002 95)`               | `oklch(0.245 0.014 250)`       | column cards, popovers       |
| `--ink`     | `oklch(0.22 0.015 255)`               | `oklch(0.93 0.008 250)`        | text                         |
| `--ink-2`   | `oklch(0.45 0.015 255)`               | `oklch(0.74 0.012 250)`        | secondary text, ranks        |
| `--rule`    | `oklch(0.88 0.006 95)`                | `oklch(0.34 0.014 250)`        | borders, row dividers        |
| `--link`    | directory blue `oklch(0.45 0.13 255)` | `oklch(0.78 0.10 245)`         | links, primary action, focus |

Not cream, not terracotta, not near-black with an acid accent: newsprint is a cool off-white and the only saturated color has one job (links and the action).

### Type

- **Libre Franklin** (variable, OFL) for interface, headings and data. Franklin Gothic is the face newspapers use for their own furniture, which is what this site is: a newspaper's index, not a newspaper. Weights 400 / 600 only.
- **Source Serif 4** (variable, OFL) only for Read prose: country summaries, FAQ answers, profile text, methodology.
- No monospace. Rank numbers use Franklin's figures with `tabular-nums`.
- Scale 1.2 for Operate (`--type-label` 0.75rem, `--type-data` 0.875rem, `--type-body` 1rem, `--type-h3` 1.2rem, `--type-h2` 1.44rem, `--type-h1` 2.07rem); Read prose 1.0625rem at line-height 1.6, measure 68ch.

### Layout (country page, first viewport at 1440 px)

```
NewsMapp    [Search countries and outlets  ⌘ K]   Suggest an outlet  ◐
Home / Europe / Germany
Newspapers and news sites in Germany
29 outlets in 8 categories, ranked by our editors
[Paywall ▾] [Ownership ▾] [Format ▾] [Filter by name…]        29 shown
┌ Top national news   9 ┐┌ Politics & government 8┐┌ Sports  4 ┐┌ Business  5 ┐
│ 1  ▣ Tagesschau  Free  PUBLIC  TV ⓘ               ...
│ 2  ▣ Der Spiegel Freemium        ⓘ
```

Left aligned throughout. Columns: 4 at ≥ 1200 px, 3 at ≥ 900 px, 2 at ≥ 640 px, 1 below with a horizontally scrollable row of anchor tabs.

### Radius and depth

Rows 0. Column cards 4 px with a 1 px `--rule` border and no shadow. Indicator tags 2 px. Popovers and the command palette float: 6 px radius and an offset shadow, no border.

### Signature

The **rank gutter**: every column starts with a right-aligned, tabular rank number in `--ink-2`, like a timetable index. Nothing else on the page is decorated.

### Attack

- _Would a different product land here?_ An "editorial paper + serif" look is the default for anything about news. What keeps this specific: the serif is confined to prose (the grid is all Franklin), the paper is cool newsprint rather than cream, there are no hairline-only broadsheet columns (cards have a real border and padding), and the only ornament is the rank gutter, which carries data.
- _Changed after review:_ dropped an all-caps "DIRECTORY" label above the H1 (eyebrow), replaced a planned accent-colored count badge in column headers with plain `--ink-2` figures, and limited the serif to prose.

## Revision: structured frames (2026-10-27)

The owner asked for the visual language of [structured.glass](https://structured.glass/), adapted rather than copied. What changed, and what did not:

- **Canvas.** A periwinkle sheet (`--canvas`) with a 32 px graticule (`--grid-line`), the grid of a map plate. Surfaces stay near-white; dark mode is a deep indigo sheet, composed separately.
- **Frames.** Square corners everywhere (`--radius-* = 0`). Cards, dialogs and inputs carry a 2 px `--edge` and a hard offset shadow (`--shadow-hard`, `--shadow-hard-lg`). Rows inside a frame keep the 1 px `--rule` hairline.
- **Action.** Violet. `--accent` fills primary buttons and the pressed topic; `--link` is the darker violet that passes 4.5:1 for text. Buttons press in: the shadow collapses and the key moves by its offset.
- **Type.** Libre Franklin stays, now up to weight 820 with tight tracking for headings and the home display line. Counts, ranks, paywall tags and shortcuts use the system monospace (`--font-data`), so no font is added to the download.
- **Kept on purpose.** No eyebrow labels and no all-caps navigation, which the reference uses. Uppercase appears only in paywall and format tags, where it is data.

## Revision: no sponsored band (2026-11-11)

With the move to a non-commercial site (ADR 0014), the sponsored band, the `--sponsor` highlighter token and the `/advertise/` page were removed. The header action is now "Suggest an outlet", and the corrections page uses the same pressed-key `.button` for its two links to GitHub issue forms.

## Revision: brand symbol (2026-11-11)

The owner supplied the brand: a globe wrapped in a newspaper over a map pin, in navy and teal, with the name set in a geometric sans (navy "News", teal "Mapp"). Sources: `docs/brand/logo.webp` and `docs/brand/symbol.webp`.

- The header shows the symbol on a white square tile with the 2 px `--edge` frame, so it reads the same in both themes, followed by the text wordmark; "Mapp" takes `--link`. The drawn folded-map SVG was removed.
- Favicon, Apple touch icon and the share image (`og:image`, `summary_large_image`) are generated by `pnpm brand:assets`.
- The site palette stays violet: the brand colors are used only inside the symbol.
