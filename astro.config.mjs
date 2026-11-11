// @ts-check
import { defineConfig, envField } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

const site = process.env.SITE_URL ?? 'https://newsmapp.github.io';
// Every internal link, icon, flag and the search index are root-relative. A GitHub Pages project
// site (https://<org>.github.io/<repo>/) would break them all: serve from a custom domain or from
// the organization's <org>.github.io repository instead (ADR 0014).
if (new URL(site).pathname !== '/') {
  throw new Error(`SITE_URL must be an origin without a path, got ${site} (see ADR 0014).`);
}

export default defineConfig({
  site,
  // Fully static: the build output is uploaded to GitHub Pages as is. No server, no adapter.
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [preact()],
  env: {
    schema: {
      ENABLED_LOCALES: envField.string({ context: 'server', access: 'public', default: 'en,pt' }),
      // "owner/repo", set by GitHub Actions on every run; links to the code and the issue forms.
      GITHUB_REPOSITORY: envField.string({
        context: 'server',
        access: 'public',
        default: 'newsmapp/newsmapp.github.io',
      }),
    },
  },
  // No Markdown code blocks; Shiki's inline styles would conflict with the CSP.
  markdown: { syntaxHighlight: false },
  security: {
    // Hash-based CSP in a <meta> tag: GitHub Pages cannot send custom response headers, so this is
    // the whole policy (frame-ancestors cannot be set from a meta tag; see ADR 0014).
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      // Pagefind compiles its search index from WebAssembly.
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'"] },
    },
  },
  vite: { plugins: [tailwindcss()] },
});
