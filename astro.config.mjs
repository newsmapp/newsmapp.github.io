// @ts-check
import { defineConfig } from 'astro/config';
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
  vite: { plugins: [tailwindcss()] },
});
