export interface MetaInput {
  /** One title, or candidates from longest to shortest; the first that fits is used. */
  title: string | readonly string[];
  description: string;
  /** Path with leading and trailing slash, e.g. "/brazil/". */
  path: string;
  siteUrl: string;
  noindex?: boolean;
  type?: 'website' | 'article' | 'profile';
  /** og:locale, e.g. "pt_BR". */
  locale?: string;
}

export interface Meta {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  og: Record<string, string>;
}

const SITE_NAME = 'NewsMapp';
const SUFFIX = ` | ${SITE_NAME}`;
export const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;

/** Joins site origin and path into an absolute URL, keeping the trailing slash policy. */
export function absoluteUrl(siteUrl: string, path: string): string {
  return new URL(path, `${siteUrl.replace(/\/$/, '')}/`).toString();
}

/** Cuts at a word boundary and adds an ellipsis when the text exceeds max. */
export function clamp(text: string, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 0)).replace(/[,.;:]$/, '')}…`;
}

/**
 * Picks the first candidate that fits in TITLE_MAX with the brand suffix, then the first that
 * fits without it (search results cut long titles), else the shortest one clamped.
 */
export function fitTitle(candidates: readonly string[], max = TITLE_MAX): string {
  const branded = (c: string) => (c === SITE_NAME || c.endsWith(SUFFIX) ? c : `${c}${SUFFIX}`);
  const withSuffix = candidates.map(branded).find((c) => c.length <= max);
  if (withSuffix) return withSuffix;
  const bare = candidates.find((c) => c.length <= max);
  if (bare) return bare;
  const shortest = [...candidates].sort((a, b) => a.length - b.length)[0] ?? SITE_NAME;
  return clamp(shortest, max);
}

export function buildMeta(input: MetaInput): Meta {
  const title = fitTitle(typeof input.title === 'string' ? [input.title] : input.title);
  const description = clamp(input.description);
  const canonical = absoluteUrl(input.siteUrl, input.path);
  return {
    title,
    description,
    canonical,
    robots: input.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large',
    og: {
      'og:type': input.type ?? 'website',
      'og:site_name': SITE_NAME,
      'og:title': title,
      'og:description': description,
      'og:url': canonical,
      'og:locale': input.locale ?? 'en_US',
    },
  };
}
