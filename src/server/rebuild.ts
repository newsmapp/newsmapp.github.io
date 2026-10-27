/** Triggers the deploy workflow so sponsorship changes reach the static pages (SPEC §3.6.1). */
export interface RebuildEnv {
  GITHUB_DISPATCH_TOKEN?: string;
  GITHUB_REPOSITORY?: string;
}

export const DEPLOY_WORKFLOW = 'deploy.yml';

export async function dispatchRebuild(
  env: RebuildEnv,
  reason: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!env.GITHUB_DISPATCH_TOKEN || !env.GITHUB_REPOSITORY) {
    console.warn(`Rebuild skipped (no GitHub token configured): ${reason}`);
    return false;
  }
  const response = await fetcher(
    `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/${DEPLOY_WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
        'user-agent': 'newsmap-worker',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({ ref: 'main', inputs: { reason: reason.slice(0, 100) } }),
    },
  );
  if (!response.ok) console.error(`Rebuild dispatch failed: HTTP ${response.status}`);
  return response.ok;
}
