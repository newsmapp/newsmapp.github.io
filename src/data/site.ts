import { GITHUB_REPOSITORY } from 'astro:env/server';

export const SITE_NAME = 'NewsMapp';

/** Public repository: source code, catalog, and the issue forms for corrections and suggestions. */
export const repoUrl = `https://github.com/${GITHUB_REPOSITORY}`;
