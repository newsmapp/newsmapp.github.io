import { existsSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
import type { Outlet } from '../../src/schemas/catalog.schema';
import { decodeHtml, fetchTracked, pool } from './http';

export const ICONS_DIR = 'public/icons';

/** Icon candidates from <link> tags, biggest first, then conventional paths. */
export function iconCandidates(html: string, pageUrl: string): string[] {
  const links: { href: string; size: number; touch: boolean }[] = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = /\brel=["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase() ?? '';
    const href = /\bhref=["']?([^"'\s>]+)/i.exec(tag)?.[1];
    if (!href || !/(^|\s)(icon|apple-touch-icon(-precomposed)?)(\s|$)/.test(rel)) continue;
    const size = Number(/\bsizes=["']?(\d+)/i.exec(tag)?.[1] ?? 0);
    links.push({ href, size, touch: rel.includes('apple-touch-icon') });
  }
  links.sort((a, b) => Number(b.touch) - Number(a.touch) || b.size - a.size);
  const urls = [...links.map((l) => l.href), '/apple-touch-icon.png', '/favicon.ico'];
  const resolved = urls.flatMap((href) => {
    try {
      const url = new URL(href.replace(/&amp;/g, '&'), pageUrl);
      return url.protocol === 'https:' ? [url.toString()] : [];
    } catch {
      return [];
    }
  });
  return [...new Set(resolved)];
}

async function download(outlet: Outlet): Promise<'ok' | 'missing'> {
  const page = await fetchTracked(outlet.url);
  const html = page.body.length > 0 ? decodeHtml(page.body, page.contentType) : '';
  for (const candidate of iconCandidates(html, page.finalUrl)) {
    const icon = await fetchTracked(candidate, 'image/*');
    if (icon.status !== 200 || icon.body.length < 64) continue;
    try {
      // sharp decodes PNG, JPEG, WebP, GIF and SVG; ICO falls through to the next candidate.
      await sharp(icon.body, { density: 300 })
        .resize(40, 40, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .webp({ quality: 82 })
        .toFile(`${ICONS_DIR}/${outlet.id}.webp`);
      return 'ok';
    } catch {
      continue;
    }
  }
  return 'missing';
}

/** Downloads favicons as 40×40 WebP. Outlets without one fall back to the build-time monogram. */
export async function runIcons(outlets: Outlet[], force: boolean): Promise<void> {
  mkdirSync(ICONS_DIR, { recursive: true });
  const targets = outlets.filter(
    (o) => o.status !== 'retired' && (force || !existsSync(`${ICONS_DIR}/${o.id}.webp`)),
  );
  const results = await pool(targets, 8, async (outlet) => ({
    id: outlet.id,
    result: await download(outlet),
  }));
  const missing = results.filter((r) => r.result === 'missing').map((r) => r.id);
  console.log(
    `Icons: ${results.length - missing.length} downloaded, ${missing.length} use a monogram`,
  );
  if (missing.length > 0) console.log(`  monogram: ${missing.join(', ')}`);
}
