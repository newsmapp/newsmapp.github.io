import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const PAGES = [
  '/',
  '/continent/europe/',
  '/portugal/',
  '/portugal/general-news/',
  '/portugal/outlet/capital-review/',
  '/advertise/',
  '/corrections/',
  '/methodology/',
  '/pt/',
  '/pt/portugal/general-news/',
  '/pt/advertise/',
];

for (const theme of ['light', 'dark'] as const) {
  for (const path of PAGES) {
    test(`${path} has no WCAG 2.2 AA violations in ${theme} theme @a11y`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .exclude('.cf-turnstile')
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
        ),
      ).toEqual([]);
    });
  }
}
