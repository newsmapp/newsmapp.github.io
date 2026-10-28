import { describe, expect, it } from 'vitest';
import { findingsFor } from './health';
import { decodeHtml, extractTitle, pool, registrableHost } from './http';
import { iconCandidates } from './icons';
import { parseFlags } from './io';

const base = {
  id: 'x-a',
  status: 'candidate' as const,
  url: 'https://www.example.com/',
  http_status: 200,
  final_url: 'https://www.example.com/',
  hops: [{ url: 'https://www.example.com/', status: 200 }],
  title: 'Example',
  error: null,
  rss: null,
};

describe('health findings', () => {
  it('is empty for a healthy outlet, including www-only redirects', () => {
    expect(findingsFor(base)).toEqual([]);
    expect(
      findingsFor({
        ...base,
        url: 'https://example.com/',
        hops: [
          { url: 'https://example.com/', status: 302 },
          { url: 'https://www.example.com/', status: 200 },
        ],
      }),
    ).toEqual([]);
  });

  it('flags errors, permanent redirects, domain changes and broken feeds', () => {
    expect(findingsFor({ ...base, http_status: null, error: 'ENOTFOUND' })).toEqual([
      'unreachable (ENOTFOUND)',
    ]);
    expect(findingsFor({ ...base, http_status: 503 })).toEqual(['HTTP 503']);
    const moved = findingsFor({
      ...base,
      final_url: 'https://new.example.org/',
      hops: [
        { url: base.url, status: 301 },
        { url: 'https://new.example.org/', status: 200 },
      ],
    });
    expect(moved).toEqual([
      'permanent redirect to https://new.example.org/',
      'domain changed to new.example.org',
    ]);
    expect(
      findingsFor({
        ...base,
        rss: { url: 'https://www.example.com/rss', http_status: 404, valid: false },
      }),
    ).toEqual(['RSS invalid (HTTP 404)']);
    expect(findingsFor({ ...base, final_url: 'not a url' })).toEqual(['invalid final URL']);
  });
});

describe('http helpers', () => {
  it('extracts and cleans titles', () => {
    expect(extractTitle('<title>\n  Folha &amp; Co &#8211; News&#x21;</title>')).toBe(
      'Folha & Co – News!',
    );
    expect(extractTitle('<title>&bogus; ok</title>')).toBe('&bogus; ok');
    // Malformed numeric references must not throw and abort a whole health run.
    expect(extractTitle('<title>News &#abc; &#x110000; Today</title>')).toBe(
      'News &#abc; &#x110000; Today',
    );
    expect(extractTitle('<html></html>')).toBeNull();
    expect(extractTitle('<title> </title>')).toBeNull();
  });

  it('decodes using the declared charset, falling back to UTF-8', () => {
    const latin1 = new Uint8Array([0x63, 0x61, 0x66, 0xe9]);
    expect(decodeHtml(latin1, 'text/html; charset=iso-8859-1')).toBe('café');
    const meta = new TextEncoder().encode('<meta charset="utf-8">ok');
    expect(decodeHtml(meta, '')).toContain('ok');
    expect(decodeHtml(new TextEncoder().encode('x'), 'text/html; charset=bogus-1')).toBe('x');
  });

  it('runs tasks with bounded concurrency and keeps order', async () => {
    let running = 0;
    let peak = 0;
    const result = await pool([1, 2, 3, 4, 5], 2, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return n * 2;
    });
    expect(result).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBe(2);
  });

  it('compares hosts without www', () => {
    expect(registrableHost('https://www.example.com/a')).toBe('example.com');
  });
});

describe('icon candidates', () => {
  it('prefers touch icons and larger sizes, resolves relative URLs and drops http', () => {
    const html = `
      <link rel="icon" href="/favicon-16.png" sizes="16x16">
      <link rel="icon" href="/favicon-32.png" sizes="32x32">
      <link rel="apple-touch-icon" href="touch.png">
      <link rel="icon" href="http://insecure.example.com/i.png">
      <link rel="stylesheet" href="/style.css">`;
    expect(iconCandidates(html, 'https://news.example.com/home/')).toEqual([
      'https://news.example.com/home/touch.png',
      'https://news.example.com/favicon-32.png',
      'https://news.example.com/favicon-16.png',
      'https://news.example.com/apple-touch-icon.png',
      'https://news.example.com/favicon.ico',
    ]);
  });
});

describe('parseFlags', () => {
  it('parses values, booleans and positionals', () => {
    const { positional, flags } = parseFlags(['file.csv', '--country', 'BR', '--force']);
    expect(positional).toEqual(['file.csv']);
    expect(flags.get('country')).toBe('BR');
    expect(flags.get('force')).toBe('true');
  });
});
