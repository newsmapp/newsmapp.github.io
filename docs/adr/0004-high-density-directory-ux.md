# 0004. High-density directory UX

- Status: accepted
- Date: 2026-10-27

## Context
Existing newspaper directories are long, unscannable lists with no context about each outlet. The product's value is letting a reader compare outlets of a country at a glance: what's free, who owns it, what format it is.

## Decision
- **Country page = 8 category columns** in a fixed order (muscle memory across countries): 3–4 columns on desktop, 2 on tablet, 1 with anchor tabs on mobile.
- **Compact 42 px outlet rows:** position, local 20×20 icon, name, and text indicators (paywall, ownership, format). Meaning never depends on color alone.
- **Detail on demand** through a native Popover (keyboard and touch accessible): pitch, owner, founding year, "Visit site", "Profile & alternatives".
- **Sponsored rows sit above organic rows, separated by a divider and labeled "Sponsored" in text.**
- Two themes (Paper Light, Terminal Dark) from tokens; type and spacing tuned for density (Operate mode in the house frontend standard).

## Alternatives considered
- Card grids with logos: lower density, slower comparison, generic look.
- Infinite lists per country: no structure, poor scanning.

## Consequences
- Requires disciplined typography and spacing to stay readable at density.
- Filters and search are client islands; the page is fully usable without them.
