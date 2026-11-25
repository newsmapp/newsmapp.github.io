/** Letters that Unicode does not decompose into a base letter plus a combining mark. */
const FOLD: Record<string, string> = {
  ł: 'l',
  ø: 'o',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ı: 'i',
};

/**
 * Normalizes text for accent- and case-insensitive matching, so "medor" finds "Médor" and
 * "goteborgs" finds "Göteborgs-Posten". Used on both sides of the outlet filter.
 */
export function searchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[łøđðþßæœı]/g, (c) => FOLD[c] ?? c)
    .replace(/\s+/g, ' ')
    .trim();
}
