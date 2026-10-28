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

test('suggesting an outlet', async ({ page }) => {
  await page.goto('/corrections/?country=PT&category=sports');
  const form = page.locator('form[data-endpoint="/api/submit/"]');
  await expect(form.getByRole('combobox', { name: 'Country' })).toHaveValue('PT');
  await form.getByRole('button', { name: /send|suggest/i }).click();
  await expect(form.locator('[data-field-error="outlet_name"]')).toHaveText(
    'Enter the outlet name.',
  );
  await form.getByLabel('Outlet name').fill('Example Sports Weekly');
  await form.getByLabel('Website').fill('https://sports-weekly.example.com/');
  await form.getByLabel(/e-mail/i).fill('editor@example.com');
  await form.getByRole('button', { name: /send|suggest/i }).click();
  await expect(form.getByRole('status')).toHaveText(/Thank you/);
});

test('Portuguese pages, language switch and translated form errors', async ({ page }) => {
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

  await page.goto('/pt/corrections/?country=PT&category=sports');
  const form = page.locator('form[data-endpoint="/api/submit/"]');
  await form.getByRole('button', { name: 'Enviar sugestão' }).click();
  await expect(form.locator('[data-field-error="outlet_name"]')).toHaveText(
    'Informe o nome do veículo.',
  );
});

test('sponsorship checkout in simulation mode', async ({ page }) => {
  await page.goto('/advertise/?country=ES&category=regional');
  const availability = page.locator('[data-availability]');
  await expect(availability).toContainText(/of 3 places open|All 3 places are taken/);
  const form = page.locator('form[data-endpoint="/api/checkout/"]');
  await expect(form.getByRole('combobox', { name: 'Country' })).toHaveValue('ES');
  await form.getByLabel('Yearly').check();
  await form.getByLabel('Outlet name').fill('Example Regional');
  await form.getByLabel('Website').fill('https://regional.example.com/');
  await form.getByLabel('Billing e-mail').fill('billing@example.com');
  await form.getByRole('button', { name: 'Reserve and go to payment' }).click();
  await expect(page).toHaveURL(/\/advertise\/thanks\/\?simulated=1$/);
  await expect(page.getByText('Test mode:')).toBeVisible();
});

test('outbound redirects only resolve allowlisted ids', async ({ request }) => {
  const known = await request.get('/go/pt-morning-ledger/', { maxRedirects: 0 });
  expect(known.status()).toBe(302);
  expect(known.headers().location).toMatch(/^https:\/\/pt-morning-ledger\.example\.com\//);
  for (const id of ['https%3A%2F%2Fevil.example', 'pt-unverified-gazette', 'aff-vpn-travel']) {
    expect((await request.get(`/go/${id}/`, { maxRedirects: 0 })).status()).toBe(404);
  }
});
