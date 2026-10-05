// The insight logic: pure functions from rows to answers. No I/O, no clock, no
// globals, so every rule here is easy to unit test and works the same whether
// the rows came from CSV files or BigQuery.

import type {
  AudienceRow,
  AudienceSeries,
  Breakout,
  ContentRow,
  Overview,
  PlatformShare,
} from './types.js';

export const MIN_DAYS = 1;
export const MAX_DAYS = 365;
export const DEFAULT_MIN_MULTIPLE = 2.5;
/** Platforms with fewer items than this in the window are too thin to judge "usual". */
export const MIN_ITEMS_FOR_BREAKOUTS = 3;

/** Keeps `days` in 1..365 so a bad argument cannot ask for an absurd window. */
export function clampDays(days: number): number {
  if (!Number.isFinite(days)) return MAX_DAYS;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(days)));
}

/**
 * First date of a window of `days` dates that ends on `newestDate`, inclusive.
 * Windows count back from the newest date in the data rather than from today,
 * so an old export or the sample data still shows a full window.
 */
export function windowStart(newestDate: string, days: number): string {
  const end = Date.parse(`${newestDate}T00:00:00Z`);
  const start = end - (days - 1) * 24 * 60 * 60 * 1000;
  return new Date(start).toISOString().slice(0, 10);
}

/** Middle value of a sorted copy; the mean of the two middle values when the count is even. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/** One series per platform, points by date, platforms with the biggest audience first. */
export function audienceSeries(rows: AudienceRow[]): AudienceSeries[] {
  const series = [...groupBy(rows, (row) => row.platform)].map(([platform, platformRows]) => ({
    platform,
    points: platformRows
      .map(({ date, audience }) => ({ date, audience }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  }));
  const latest = (s: AudienceSeries) => s.points.at(-1)?.audience ?? 0;
  return series.sort((a, b) => latest(b) - latest(a) || a.platform.localeCompare(b.platform));
}

/** Per platform: latest audience, share of the combined audience, and gain across the window. */
export function platformBreakdown(rows: AudienceRow[]): PlatformShare[] {
  const series = audienceSeries(rows);
  const combined = series.reduce((sum, s) => sum + (s.points.at(-1)?.audience ?? 0), 0);
  return series.map(({ platform, points }) => {
    const first = points[0]?.audience ?? 0;
    const last = points.at(-1)?.audience ?? 0;
    return {
      platform,
      audience: last,
      share: combined > 0 ? last / combined : 0,
      gained: last - first,
    };
  });
}

/**
 * Headline numbers for the window. The combined audience adds up each
 * platform's latest number, so a fan who follows on two platforms counts twice.
 */
export function overview(rows: AudienceRow[], days: number): Overview {
  const breakdown = platformBreakdown(rows);
  const dates = rows.map((row) => row.date).sort();
  let top: PlatformShare | null = null;
  for (const share of breakdown) {
    if (share.gained > 0 && (!top || share.gained > top.gained)) top = share;
  }
  return {
    days,
    startDate: dates[0] ?? null,
    endDate: dates.at(-1) ?? null,
    combinedAudience: breakdown.reduce((sum, s) => sum + s.audience, 0),
    gained: breakdown.reduce((sum, s) => sum + s.gained, 0),
    topPlatform: top?.platform ?? null,
    topPlatformGained: top?.gained ?? 0,
  };
}

/**
 * Content that did at least `minMultiple` times better than usual for its platform.
 * "Usual" is the median, not the mean: one viral post drags the mean up so far
 * that the next good post (or the hit itself) no longer stands out.
 */
export function findBreakouts(rows: ContentRow[], minMultiple = DEFAULT_MIN_MULTIPLE): Breakout[] {
  const breakouts: Breakout[] = [];
  for (const [, items] of groupBy(rows, (row) => row.platform)) {
    if (items.length < MIN_ITEMS_FOR_BREAKOUTS) continue;
    const typical = median(items.map((item) => item.views));
    if (typical <= 0) continue;
    for (const item of items) {
      const multiple = item.views / typical;
      if (multiple >= minMultiple) {
        breakouts.push({
          title: item.title,
          platform: item.platform,
          contentType: item.contentType,
          publishedDate: item.publishedDate,
          views: item.views,
          typicalViews: Math.round(typical),
          multiple: Math.round(multiple * 100) / 100,
        });
      }
    }
  }
  return breakouts.sort((a, b) => b.multiple - a.multiple || b.views - a.views);
}
