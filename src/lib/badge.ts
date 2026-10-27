/** Badge served at /badge/[country]/[outlet].svg (H2). Pure so it can be tested and cached. */
export const BADGE_SIZE = { width: 232, height: 40 } as const;

const escapeXml = (value: string): string =>
  value.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] ?? c,
  );

export interface BadgeInput {
  rank: number;
  category: string;
  country: string;
}

/** "Listed on NewsMap · #N in [Category], [Country]" as a self-contained SVG. */
export function badgeSvg({ rank, category, country }: BadgeInput): string {
  const { width, height } = BADGE_SIZE;
  const raw = `#${rank} in ${category}, ${country}`;
  const line = escapeXml(raw);
  const label = escapeXml(`Listed on NewsMap: #${rank} in ${category}, ${country}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}"><title>${label}</title><rect width="${width}" height="${height}" rx="4" fill="#1f2a37"/><rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="3.5" fill="none" stroke="#3b4a5c"/><text x="12" y="16" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="10" fill="#c9d3de">Listed on NewsMap</text><text x="12" y="30" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="12" font-weight="600" fill="#f5f7fa" textLength="${Math.min(Math.round(raw.length * 6.6), width - 24)}" lengthAdjust="spacingAndGlyphs">${line}</text></svg>`;
}
