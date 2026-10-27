import { defineConfig, devices } from '@playwright/test';

/**
 * E2E and accessibility checks against the fixtures build served by the real Worker
 * (wrangler dev + local D1), so forms, slots and simulated checkout run end to end.
 * Build first: CATALOG_DIR=tests/fixtures/catalog pnpm build
 */
const PORT = 8788;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@a11y|@mobile/ },
  ],
  webServer: {
    command: `pnpm db:migrate:local && pnpm exec wrangler dev --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
