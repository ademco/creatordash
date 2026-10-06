import { describe, expect, it } from 'vitest';

import {
  dailyGains,
  indexForDate,
  layoutWave,
  netGain,
  peakDay,
  playbackIndex,
  stackDay,
  totalThrough,
} from './waveform';

const series = [
  {
    platform: 'spotify',
    points: [
      { date: '2026-09-01', audience: 100 },
      { date: '2026-09-02', audience: 110 },
      { date: '2026-09-03', audience: 105 },
      { date: '2026-09-04', audience: 205 },
    ],
  },
  {
    platform: 'tiktok',
    points: [
      { date: '2026-09-01', audience: 50 },
      { date: '2026-09-02', audience: 70 },
      { date: '2026-09-03', audience: 70 },
      { date: '2026-09-04', audience: 90 },
    ],
  },
];

describe('dailyGains', () => {
  it('makes one bar per day after the first, with a gain per platform', () => {
    const days = dailyGains(series);
    expect(days.map((d) => d.date)).toEqual(['2026-09-02', '2026-09-03', '2026-09-04']);
    expect(days[0]?.gains).toEqual({ spotify: 10, tiktok: 20 });
  });

  it('keeps gains and losses apart', () => {
    const day = dailyGains(series)[1];
    expect(day?.up).toBe(0);
    expect(day?.down).toBe(-5);
    expect(day && netGain(day)).toBe(-5);
  });

  it('gives nothing for no data or a single point', () => {
    expect(dailyGains([])).toEqual([]);
    expect(dailyGains([{ platform: 'kick', points: [{ date: '2026-09-01', audience: 5 }] }])).toEqual([]);
  });

  it('treats a platform with no point on a day as zero, and sorts days', () => {
    const days = dailyGains([
      { platform: 'spotify', points: [{ date: '2026-09-03', audience: 12 }, { date: '2026-09-01', audience: 10 }] },
      { platform: 'kick', points: [{ date: '2026-09-02', audience: 1 }, { date: '2026-09-03', audience: 4 }] },
    ]);
    // Spotify skipped Sep 2, so its +2 lands on Sep 3, the next day it has a point.
    expect(days).toEqual([
      { date: '2026-09-03', gains: { spotify: 2, kick: 3 }, up: 5, down: 0 },
    ]);
  });
});

describe('totals, peak, and date lookup', () => {
  const days = dailyGains(series);

  it('adds up the net gain from the start through a day', () => {
    expect(totalThrough(days, 0)).toBe(30);
    expect(totalThrough(days, 2)).toBe(30 - 5 + 120);
    // Matches last audience minus first, summed over platforms: (205-100) + (90-50).
    expect(totalThrough(days, 99)).toBe(145);
  });

  it('finds the biggest day', () => {
    expect(peakDay(days)?.date).toBe('2026-09-04');
    expect(peakDay([])).toBeNull();
  });

  it('finds the day for a date, clamping to the ends', () => {
    expect(indexForDate(days, '2026-09-03')).toBe(1);
    expect(indexForDate(days, '2026-08-01')).toBe(0);
    expect(indexForDate(days, '2027-01-01')).toBe(2);
    expect(indexForDate([], '2026-09-03')).toBe(0);
  });
});

describe('playbackIndex', () => {
  it('starts on the first day and lands exactly on the last', () => {
    expect(playbackIndex(0, 8000, 90)).toBe(0);
    expect(playbackIndex(8000, 8000, 90)).toBe(89);
    expect(playbackIndex(99999, 8000, 90)).toBe(89);
  });

  it('is eased: slower than linear at the start', () => {
    expect(playbackIndex(1000, 8000, 101)).toBeLessThan(12);
  });

  it('copes with no days', () => {
    expect(playbackIndex(500, 8000, 0)).toBe(0);
  });
});

describe('stackDay', () => {
  it('stacks gains upward and losses downward in the given platform order', () => {
    const day = { date: 'd', gains: { spotify: 10, youtube: -4, tiktok: 20, twitch: -1 }, up: 30, down: -5 };
    expect(stackDay(day, ['spotify', 'youtube', 'twitch', 'kick', 'tiktok'])).toEqual([
      { platform: 'spotify', start: 0, end: 10 },
      { platform: 'youtube', start: 0, end: -4 },
      { platform: 'twitch', start: -4, end: -5 },
      { platform: 'tiktok', start: 10, end: 30 },
    ]);
  });
});

describe('layoutWave', () => {
  const size = { width: 300, height: 100, baseline: 60 };
  const order = ['spotify', 'tiktok'];

  it('puts gains above the center line and losses below it', () => {
    const rects = layoutWave(dailyGains(series), order, size);
    const loss = rects.find((r) => r.key === '2026-09-03-spotify');
    const gain = rects.find((r) => r.key === '2026-09-04-spotify');
    expect(loss && loss.y).toBeGreaterThanOrEqual(size.baseline);
    expect(gain && gain.y + gain.height).toBeLessThanOrEqual(size.baseline);
  });

  it('lets the biggest day just fill its half', () => {
    const rects = layoutWave(dailyGains(series), order, size).filter((r) => r.key.startsWith('2026-09-04'));
    const top = Math.min(...rects.map((r) => r.y));
    expect(top).toBeLessThan(1);
  });

  it('uses one scale for both halves', () => {
    const days = [
      { date: 'a', gains: { spotify: 10 }, up: 10, down: 0 },
      { date: 'b', gains: { spotify: -10 }, up: 0, down: -10 },
    ];
    const [gain, loss] = layoutWave(days, order, size);
    expect(gain && loss && Math.abs(gain.height - loss.height)).toBeLessThan(0.01);
  });

  it('draws nothing when there is no change at all', () => {
    expect(layoutWave([], order, size)).toEqual([]);
    expect(layoutWave([{ date: 'a', gains: { spotify: 0 }, up: 0, down: 0 }], order, size)).toEqual([]);
  });
});
