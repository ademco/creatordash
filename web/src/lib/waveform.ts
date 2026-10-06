// The maths behind the waveform: each day's fan gain per platform, stacked into
// bars. Gains stack upward from a center line, losses downward. Everything here
// is pure (no React, no DOM), so the numbers are unit tested.

export interface Series {
  platform: string;
  points: { date: string; audience: number }[];
}

/** One day on the waveform. */
export interface WaveDay {
  date: string;
  /** Change since the previous point, per platform. A platform with no point that day is absent (counts as 0). */
  gains: Record<string, number>;
  /** Sum of the positive gains. */
  up: number;
  /** Sum of the negative gains (zero or below). */
  down: number;
}

/**
 * Turns audience series into day-over-day gains. A platform's first point has
 * nothing before it, so it makes no bar: a window of N days gives N-1 bars.
 * If a platform skips days, its change lands on the next day it has a point.
 */
export function dailyGains(series: Series[]): WaveDay[] {
  const byDate = new Map<string, Record<string, number>>();
  for (const { platform, points } of series) {
    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const previous = sorted[i - 1];
      if (!current || !previous) continue;
      const gains = byDate.get(current.date) ?? {};
      gains[platform] = current.audience - previous.audience;
      byDate.set(current.date, gains);
    }
  }
  return [...byDate.keys()]
    .sort()
    .map((date) => {
      const gains = byDate.get(date) ?? {};
      const values = Object.values(gains);
      return {
        date,
        gains,
        up: values.filter((v) => v > 0).reduce((sum, v) => sum + v, 0),
        down: values.filter((v) => v < 0).reduce((sum, v) => sum + v, 0),
      };
    });
}

/** Net fans gained on one day, across platforms. */
export function netGain(day: WaveDay): number {
  return day.up + day.down;
}

/** Fans gained from the start of the window through day `index` (inclusive). */
export function totalThrough(days: WaveDay[], index: number): number {
  let total = 0;
  for (let i = 0; i <= index && i < days.length; i++) {
    const day = days[i];
    if (day) total += netGain(day);
  }
  return total;
}

/** The day with the biggest net gain, or null when there are no days. */
export function peakDay(days: WaveDay[]): WaveDay | null {
  let best: WaveDay | null = null;
  for (const day of days) {
    if (!best || netGain(day) > netGain(best)) best = day;
  }
  return best;
}

/** Index of the first day on or after `date`; past the end means the last day. */
export function indexForDate(days: WaveDay[], date: string): number {
  if (days.length === 0) return 0;
  const found = days.findIndex((day) => day.date >= date);
  return found === -1 ? days.length - 1 : found;
}

/**
 * Which day the playhead is on `elapsedMs` into a `durationMs` sweep. Starts
 * and ends gently (smoothstep), and lands exactly on the last day at the end.
 */
export function playbackIndex(elapsedMs: number, durationMs: number, length: number): number {
  if (length <= 0) return 0;
  const progress = Math.min(Math.max(elapsedMs / durationMs, 0), 1);
  const eased = progress * progress * (3 - 2 * progress);
  return Math.round(eased * (length - 1));
}

export interface Segment {
  platform: string;
  /** Where the segment starts and ends, in fans from the center line (negative is below it). */
  start: number;
  end: number;
}

/** One day's segments in fixed platform order: gains stack up, losses stack down. */
export function stackDay(day: WaveDay, order: readonly string[]): Segment[] {
  const segments: Segment[] = [];
  let up = 0;
  let down = 0;
  for (const platform of order) {
    const value = day.gains[platform] ?? 0;
    if (value > 0) {
      segments.push({ platform, start: up, end: up + value });
      up += value;
    } else if (value < 0) {
      segments.push({ platform, start: down, end: down + value });
      down += value;
    }
  }
  return segments;
}

export interface Rect {
  key: string;
  platform: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WaveSize {
  width: number;
  height: number;
  /** Y of the center line. Gains grow up from it, losses down. */
  baseline: number;
}

/** Share of each day's slot left empty between bars. */
const BAR_GAP = 0.3;
/** Trimmed from each stacked segment's edges so neighbours read as separate pieces. */
const SEGMENT_INSET = 0.4;

/**
 * Rectangles for every segment of every day. One scale serves both halves, so
 * a 100-fan gain and a 100-fan loss are the same height. The biggest day just
 * fits in its half. Quiet days still get at least 1 unit so they stay visible.
 */
export function layoutWave(days: WaveDay[], order: readonly string[], size: WaveSize): Rect[] {
  const maxUp = Math.max(0, ...days.map((d) => d.up));
  const maxDown = Math.max(0, ...days.map((d) => -d.down));
  const scales = [maxUp > 0 ? size.baseline / maxUp : Infinity, maxDown > 0 ? (size.height - size.baseline) / maxDown : Infinity];
  const scale = Math.min(...scales);
  if (!Number.isFinite(scale)) return [];

  const slot = size.width / days.length;
  const rects: Rect[] = [];
  days.forEach((day, index) => {
    for (const { platform, start, end } of stackDay(day, order)) {
      const full = Math.max(Math.abs(end - start) * scale, 1);
      const inset = full > 2 * SEGMENT_INSET + 1 ? SEGMENT_INSET : 0;
      rects.push({
        key: `${day.date}-${platform}`,
        platform,
        x: index * slot + (slot * BAR_GAP) / 2,
        y: size.baseline - Math.max(start, end) * scale + inset,
        width: slot * (1 - BAR_GAP),
        height: full - inset * 2,
      });
    }
  });
  return rects;
}
