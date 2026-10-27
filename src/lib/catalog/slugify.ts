/** Latin letters that NFKD does not decompose into ASCII. */
const FOLD: Record<string, string> = {
  ı: 'i',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  ø: 'o',
  œ: 'oe',
  æ: 'ae',
  ß: 'ss',
  þ: 'th',
};

/** ASCII slug: strips diacritics, lowercases, joins words with hyphens. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ıłđðøœæßþ]/g, (c) => FOLD[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
