import { describe, expect, it } from 'vitest';

import {
  audienceSeries,
  clampDays,
  findBreakouts,
  median,
  overview,
  platformBreakdown,
  windowStart,
} from './insights.js';
import type { AudienceRow, ContentRow, Platform } from './types.js';

const row = (date: string, platform: Platform, audience: number): AudienceRow => ({ date, platform, audience });

// Two platforms over three days, deliberately out of order.
const AUDIENCE: AudienceRow[] = [
  row('2026-09-30', 'youtube', 300),
  row('2026-09-28', 'spotify', 1000),
  row('2026-09-28', 'youtube', 100),
  row('2026-09-30', 'spotify', 900),
  row('2026-09-29', 'youtube', 200),
  row('2026-09-29', 'spotify', 950),
];

function content(platform: Platform, views: number[]): ContentRow[] {
  return views.map((v, i) => ({
    publishedDate: `2026-09-${String(10 + i).padStart(2, '0')}`,
    platform,
    contentType: platform === 'spotify' ? 'release' : 'video',
    title: `${platform} #${i + 1}`,
    views: v,
  }));
}

describe('clampDays', () => {
  it('keeps days between 1 and 365 and rounds fractions', () => {
    expect(clampDays(30)).toBe(30);
    expect(clampDays(0)).toBe(1);
    expect(clampDays(-5)).toBe(1);
    expect(clampDays(1000)).toBe(365);
    expect(clampDays(29.6)).toBe(30);
    expect(clampDays(Number.NaN)).toBe(365);
  });
});

describe('windowStart', () => {
  it('counts back so the window holds exactly `days` dates, including the newest', () => {
    expect(windowStart('2026-09-30', 1)).toBe('2026-09-30');
    expect(windowStart('2026-09-30', 30)).toBe('2026-09-01');
    expect(windowStart('2026-09-30', 180)).toBe('2026-04-04');
  });

  it('crosses month and leap-year boundaries correctly', () => {
    expect(windowStart('2028-03-01', 2)).toBe('2028-02-29');
    expect(windowStart('2027-01-01', 2)).toBe('2026-12-31');
  });
});

describe('median', () => {
  it('takes the middle value, or the mean of the two middle values', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it('does not change the input array', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('audienceSeries', () => {
  it('returns one series per platform, sorted by date, biggest latest audience first', () => {
    expect(audienceSeries(AUDIENCE)).toEqual([
      {
        platform: 'spotify',
        points: [
          { date: '2026-09-28', audience: 1000 },
          { date: '2026-09-29', audience: 950 },
          { date: '2026-09-30', audience: 900 },
        ],
      },
      {
        platform: 'youtube',
        points: [
          { date: '2026-09-28', audience: 100 },
          { date: '2026-09-29', audience: 200 },
          { date: '2026-09-30', audience: 300 },
        ],
      },
    ]);
  });

  it('returns an empty list for no rows', () => {
    expect(audienceSeries([])).toEqual([]);
  });
});

describe('platformBreakdown', () => {
  it('gives latest audience, share of the combined total, and gain (last minus first)', () => {
    expect(platformBreakdown(AUDIENCE)).toEqual([
      { platform: 'spotify', audience: 900, share: 0.75, gained: -100 },
      { platform: 'youtube', audience: 300, share: 0.25, gained: 200 },
    ]);
  });

  it('shares add up to 1', () => {
    const total = platformBreakdown(AUDIENCE).reduce((sum, s) => sum + s.share, 0);
    expect(total).toBeCloseTo(1);
  });

  it('gives a share of 0 instead of dividing by zero when every audience is 0', () => {
    expect(platformBreakdown([row('2026-09-30', 'kick', 0)])).toEqual([
      { platform: 'kick', audience: 0, share: 0, gained: 0 },
    ]);
  });
});

describe('overview', () => {
  it('sums latest audiences and gains, and names the platform that grew most', () => {
    expect(overview(AUDIENCE, 3)).toEqual({
      days: 3,
      startDate: '2026-09-28',
      endDate: '2026-09-30',
      combinedAudience: 1200,
      gained: 100,
      topPlatform: 'youtube',
      topPlatformGained: 200,
    });
  });

  it('has no top platform when nothing grew', () => {
    const shrinking = [row('2026-09-29', 'spotify', 10), row('2026-09-30', 'spotify', 8)];
    expect(overview(shrinking, 2)).toMatchObject({ gained: -2, topPlatform: null, topPlatformGained: 0 });
  });

  it('handles an empty window', () => {
    expect(overview([], 30)).toEqual({
      days: 30,
      startDate: null,
      endDate: null,
      combinedAudience: 0,
      gained: 0,
      topPlatform: null,
      topPlatformGained: 0,
    });
  });
});

describe('findBreakouts', () => {
  it('flags content at or above minMultiple times the platform median', () => {
    // Median of [100, 100, 100, 250, 400] is 100.
    const result = findBreakouts(content('youtube', [100, 400, 100, 250, 100]));
    expect(result.map((b) => [b.title, b.multiple, b.typicalViews])).toEqual([
      ['youtube #2', 4, 100],
      ['youtube #4', 2.5, 100],
    ]);
  });

  it('uses the median, so one hit does not hide the next one', () => {
    // The mean here is about 2,029, which would make the 2,000-view video look ordinary.
    // The median is 500, so both hits stand out.
    const result = findBreakouts(content('youtube', [500, 400, 600, 10000, 2000, 500, 200]));
    expect(result.map((b) => b.views)).toEqual([10000, 2000]);
  });

  it('judges each platform against its own median', () => {
    const rows = [...content('spotify', [10000, 10000, 30000]), ...content('youtube', [100, 100, 300])];
    const result = findBreakouts(rows);
    expect(result.map((b) => [b.platform, b.multiple])).toEqual([
      ['spotify', 3],
      ['youtube', 3],
    ]);
  });

  it('skips platforms with fewer than 3 items', () => {
    expect(findBreakouts(content('spotify', [100, 1000]))).toEqual([]);
  });

  it('sorts by multiple, highest first, and respects a custom minMultiple', () => {
    const rows = [...content('tiktok', [100, 100, 100, 700, 300]), ...content('twitch', [10, 10, 10, 50])];
    expect(findBreakouts(rows, 3).map((b) => b.multiple)).toEqual([7, 5, 3]);
  });

  it('ignores a platform whose median is 0', () => {
    expect(findBreakouts(content('kick', [0, 0, 0, 5]))).toEqual([]);
  });
});
