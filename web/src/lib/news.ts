// Small helpers for showing headlines. Pure, so the edge cases are tested.

import { formatShortDate } from './format';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5m ago", "3h ago", "2d ago", or "Sep 28" once it is over a week old. */
export function relativeTime(isoDateTime: string, now: Date): string {
  const published = new Date(isoDateTime);
  if (Number.isNaN(published.getTime())) return '';
  const age = now.getTime() - published.getTime();
  if (age < MINUTE) return 'just now'; // also covers clocks a little ahead of ours
  if (age < HOUR) return `${Math.floor(age / MINUTE)}m ago`;
  if (age < DAY) return `${Math.floor(age / HOUR)}h ago`;
  if (age < 7 * DAY) return `${Math.floor(age / DAY)}d ago`;
  return formatShortDate(isoDateTime.slice(0, 10));
}

/**
 * Headlines come from the internet, so the page does not trust them: only web
 * links become links. The API already filters, and this checks again.
 */
export function safeHref(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The headlines for the "Around the web" panel: stories about a platform the
 * artist is on come first (newest first within that), then general music news
 * fills the rest. Input is already newest first.
 */
export function panelItems<T extends { platform: string | null }>(items: T[], count: number): T[] {
  const about = items.filter((item) => item.platform !== null);
  const general = items.filter((item) => item.platform === null);
  return [...about, ...general].slice(0, count);
}
