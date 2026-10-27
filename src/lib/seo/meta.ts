export interface MetaInput {
  title: string;
  description: string;
  /** Path with leading and trailing slash, e.g. "/brazil/". */
  path: string;
  siteUrl: string;
  noindex?: boolean;
  type?: 'website' | 'article' | 'profile';
}

export interface Meta {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  og: Record<string, string>;
}

const SITE_NAME = 'NewsMap';
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

export function buildMeta(input: MetaInput): Meta {
  const title =
    input.title.endsWith(`| ${SITE_NAME}`) || input.title === SITE_NAME
      ? input.title
      : `${input.title} | ${SITE_NAME}`;
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
      'og:locale': 'en_US',
    },
  };
}
