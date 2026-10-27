const STOPWORDS = new Set([
  'the',
  'la',
  'le',
  'el',
  'il',
  'der',
  'die',
  'das',
  'de',
  'o',
  'a',
  'of',
]);

/** Up to two initials from the meaningful words of a name ("The New York Times" → "NY"). */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const meaningful = words.filter((w) => !STOPWORDS.has(w.toLowerCase()));
  const pick = meaningful.length > 0 ? meaningful : words;
  const [first, second] = pick;
  if (!first) return '?';
  // Scripts without letter case (CJK, Arabic, …) read better as a single glyph.
  if (first.toUpperCase() === first.toLowerCase()) return [...first][0] ?? '?';
  return ((first[0] ?? '') + (second?.[0] ?? '')).toUpperCase();
}

/** FNV-1a: stable across runtimes, so the same outlet always gets the same monogram. */
export function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const escapeXml = (value: string): string =>
  value.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Deterministic 40×40 SVG monogram used when an outlet has no usable favicon. */
export function monogramSvg(id: string, name: string): string {
  const hue = hash(id) % 360;
  const letters = escapeXml(initials(name));
  const size = letters.length > 1 ? 16 : 19;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="6" fill="hsl(${hue} 32% 38%)"/><text x="20" y="20" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${size}" font-weight="600" fill="#fff">${letters}</text></svg>`;
}
