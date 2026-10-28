// @ts-check
import { defineConfig, envField } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://newsmap.example',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // No sessions: avoids provisioning a KV namespace nobody uses.
  session: false,
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [preact()],
  env: {
    schema: {
      ADS_ENABLED: envField.boolean({ context: 'server', access: 'public', default: false }),
      ENABLED_LOCALES: envField.string({ context: 'server', access: 'public', default: 'en,pt' }),
      // Cloudflare's always-pass test key by default; the real key is public too.
      TURNSTILE_SITE_KEY: envField.string({
        context: 'client',
        access: 'public',
        default: '1x00000000000000000000AA',
      }),
    },
  },
  // No Markdown code blocks; Shiki's inline styles would conflict with the CSP.
  markdown: { syntaxHighlight: false },
  security: {
    // Hash-based CSP in a <meta> tag. Directives a meta tag cannot carry
    // (frame-ancestors) are sent as headers from public/_headers.
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
