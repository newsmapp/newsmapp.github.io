/**
 * Links to the repository's GitHub issue forms (.github/ISSUE_TEMPLATE/), which replace the old
 * Worker forms: corrections and outlet suggestions are public issues the owner reviews.
 * Query parameters named after a field id prefill that field.
 */
export type IssueForm = 'correction' | 'suggestion';

export function issueFormUrl(
  repoUrl: string,
  form: IssueForm,
  fields: Readonly<Record<string, string | undefined>> = {},
): string {
  const url = new URL(`${repoUrl.replace(/\/+$/, '')}/issues/new`);
  url.searchParams.set('template', `${form}.yml`);
  for (const [name, value] of Object.entries(fields)) if (value) url.searchParams.set(name, value);
  return url.toString();
}
