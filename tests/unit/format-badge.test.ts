import { describe, expect, it } from 'vitest';
import { BADGE_SIZE, badgeSvg } from '@/lib/badge';
import { displayHost, formatCompact, formatNumber, plural } from '@/lib/format';

describe('format', () => {
  it('formats numbers in en-US', () => {
    expect(formatNumber(10_639_726)).toBe('10,639,726');
    expect(formatCompact(10_639_726)).toBe('10.6M');
  });

  it('pluralizes with a default and a custom plural', () => {
    expect(plural(1, 'outlet')).toBe('1 outlet');
    expect(plural(2, 'outlet')).toBe('2 outlets');
    expect(plural(3, 'category', 'categories')).toBe('3 categories');
  });

  it('shows the host without www', () => {
    expect(displayHost('https://www.example.com/path?q=1')).toBe('example.com');
    expect(displayHost('https://news.example.org/')).toBe('news.example.org');
  });
});

describe('badgeSvg', () => {
  it('renders the rank line at the fixed size', () => {
    const svg = badgeSvg({ rank: 2, category: 'Sports', country: 'Brazil' });
    expect(svg).toContain(`width="${BADGE_SIZE.width}" height="${BADGE_SIZE.height}"`);
    expect(svg).toContain('#2 in Sports, Brazil');
    expect(svg).toContain('aria-label="Listed on NewsMapp: #2 in Sports, Brazil"');
  });

  it('escapes markup in names', () => {
    const svg = badgeSvg({ rank: 1, category: 'Business, Finance & Markets', country: '<x>"' });
    expect(svg).toContain('Finance &amp; Markets');
    expect(svg).not.toContain('<x>');
    expect(svg).toContain('&lt;x&gt;&quot;');
  });
});
