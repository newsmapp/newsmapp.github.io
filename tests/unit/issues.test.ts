import { describe, expect, it } from 'vitest';
import { issueFormUrl } from '@/lib/issues';

describe('issueFormUrl', () => {
  it('links to the issue form and prefills only the fields given', () => {
    const url = new URL(
      issueFormUrl('https://github.com/org/newsmapp/', 'suggestion', {
        country: 'PT',
        category: 'sports',
        note: undefined,
      }),
    );
    expect(url.origin + url.pathname).toBe('https://github.com/org/newsmapp/issues/new');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      template: 'suggestion.yml',
      country: 'PT',
      category: 'sports',
    });
  });

  it('encodes values', () => {
    const url = issueFormUrl('https://github.com/org/newsmapp', 'correction', { outlet: 'a&b c' });
    expect(url).toBe(
      'https://github.com/org/newsmapp/issues/new?template=correction.yml&outlet=a%26b+c',
    );
  });
});
