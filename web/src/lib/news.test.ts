import { describe, expect, it } from 'vitest';

import { panelItems, relativeTime, safeHref } from './news';

const NOW = new Date('2026-10-06T12:00:00Z');

describe('relativeTime', () => {
  it('says how long ago in the biggest sensible unit', () => {
    expect(relativeTime('2026-10-06T11:59:40Z', NOW)).toBe('just now');
    expect(relativeTime('2026-10-06T11:55:00Z', NOW)).toBe('5m ago');
    expect(relativeTime('2026-10-06T09:00:00Z', NOW)).toBe('3h ago');
    expect(relativeTime('2026-10-04T12:00:00Z', NOW)).toBe('2d ago');
  });

  it('switches to a date after a week', () => {
    expect(relativeTime('2026-09-28T08:00:00Z', NOW)).toBe('Sep 28');
  });

  it('treats a slightly-future time as just now, and junk as nothing', () => {
    expect(relativeTime('2026-10-06T12:03:00Z', NOW)).toBe('just now');
    expect(relativeTime('not a date', NOW)).toBe('');
  });
});

describe('safeHref', () => {
  it('keeps web links and drops everything else', () => {
    expect(safeHref('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeHref('http://example.com')).toBe('http://example.com/');
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('data:text/html,<b>x</b>')).toBeUndefined();
    expect(safeHref('')).toBeUndefined();
  });
});

describe('panelItems', () => {
  const items = [
    { id: 1, platform: null },
    { id: 2, platform: 'tiktok' },
    { id: 3, platform: null },
    { id: 4, platform: 'spotify' },
  ];

  it('puts headlines about a platform first, keeping their order, then fills with the rest', () => {
    expect(panelItems(items, 3).map((i) => i.id)).toEqual([2, 4, 1]);
  });

  it('returns everything when there are fewer than asked for', () => {
    expect(panelItems(items, 10)).toHaveLength(4);
    expect(panelItems([], 6)).toEqual([]);
  });
});
