import { expect, test } from './fixtures';

test('reader journey: country, filter, search, profile and badge', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page
    .getByRole('link', { name: /^Portugal\b/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/portugal\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Portugal');

  await page.getByRole('combobox', { name: 'Paywall' }).selectOption('free');
  await expect(page.getByRole('status').filter({ hasText: 'outlets shown' })).toBeVisible();
  await expect(page).toHaveURL(/paywall=free/);
  const visible = page.locator('[data-outlet-row]:visible');
  await expect(visible.first()).toBeVisible();
  for (const paywall of await visible.evaluateAll((rows) =>
    rows.map((r) => r.getAttribute('data-paywall')),
  )) {
    expect(paywall).toBe('free');
  }

  await page.keyboard.press('ControlOrMeta+k');
  const search = page.getByRole('combobox', { name: /search countries/i });
  await expect(search).toBeFocused();
  await search.fill('Capital Review');
  const hit = page.getByRole('option').filter({ hasText: 'Portugal Capital Review' });
  await expect(hit).toBeVisible();
  await hit.getByRole('link').click();
  await expect(page).toHaveURL(/\/portugal\/outlet\/capital-review\/$/);

  await page.getByRole('button', { name: 'Copy HTML' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '/badge/portugal/capital-review.svg',
  );
  const badge = await page.request.get('/badge/portugal/capital-review.svg');
  expect(badge.headers()['content-type']).toContain('image/svg+xml');
  expect(await badge.text()).toContain('in Business, Finance &amp; Markets, Portugal');
});

test('detail card opens and closes from the keyboard', async ({ page }) => {
  await page.goto('/portugal/');
  const info = page.getByRole('button', { name: 'About Portugal Morning Ledger' }).first();
  await info.focus();
  await page.keyboard.press('Enter');
  const card = page.locator('.detail:popover-open');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Visit site');
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(info).toBeFocused();
});

test('theme toggle switches and persists', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  await page.locator('[data-theme-toggle]').click();
  const after = before === 'dark' ? 'light' : 'dark';
  await expect(html).toHaveAttribute('data-theme', after);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', after);
});

test('corrections and suggestions open prefilled GitHub issue forms', async ({ page }) => {
  await page.goto('/portugal/outlet/capital-review/');
  const correction = page.getByRole('link', { name: 'Report a correction' }).first();
  const fix = new URL((await correction.getAttribute('href')) ?? '');
  expect(fix.hostname).toBe('github.com');
  expect(fix.pathname).toMatch(/\/issues\/new$/);
  expect(fix.searchParams.get('template')).toBe('correction.yml');
  expect(fix.searchParams.get('outlet')).toBe('pt-capital-review');

  await page.goto('/portugal/');
  const suggest = new URL(
    (await page.getByRole('link', { name: 'Suggest an outlet' }).last().getAttribute('href')) ?? '',
  );
  expect(suggest.searchParams.get('template')).toBe('suggestion.yml');
  expect(suggest.searchParams.get('country')).toBe('PT');

  await page.goto('/corrections/');
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open a correction' })).toHaveAttribute(
    'href',
    /\/issues\/new\?template=correction\.yml$/,
  );
});

test('Portuguese pages and language switch', async ({ page }) => {
  await page.goto('/pt/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await page
    .getByRole('link', { name: /^Brasil\b/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/pt\/brazil\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Brasil');
  await page.locator('a[hreflang="en"]').first().click();
  await expect(page).toHaveURL(/\/brazil\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  // A page that exists in English only: no hreflang to Portuguese, and the switch leads to the
  // Portuguese country page instead of a 404.
  await page.goto('/france/economy/');
  await expect(page.locator('link[hreflang="pt-BR"]')).toHaveCount(0);
  await expect(page.locator('a[data-lang-switch]')).toHaveAttribute('href', '/pt/france/');

  await page.goto('/pt/corrections/');
  await expect(page.getByRole('link', { name: 'Sugerir um veículo' }).last()).toHaveAttribute(
    'href',
    /template=suggestion\.yml/,
  );
});

test('former server routes are gone', async ({ request }) => {
  for (const path of ['/go/pt-morning-ledger/', '/api/track/', '/admin/', '/advertise/'])
    expect((await request.get(path, { maxRedirects: 0 })).status()).toBe(404);
});
