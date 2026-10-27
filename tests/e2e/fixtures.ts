import { test as base, expect } from '@playwright/test';

/**
 * Turnstile's script is replaced by a stub that fills the token field with Cloudflare's test
 * token; the Worker verifies it against the always-pass test secret from .dev.vars.
 */
const TURNSTILE_STUB = `
  document.querySelectorAll('.cf-turnstile').forEach((el) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'cf-turnstile-response';
    input.value = 'XXXX.DUMMY.TOKEN.XXXX';
    el.appendChild(input);
  });
  window.turnstile = { reset() {} };
`;

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('https://challenges.cloudflare.com/**', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: TURNSTILE_STUB }),
    );
    await use(page);
  },
});

export { expect };
