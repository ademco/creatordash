// Writes the headline in plain words from the numbers. Kept as pure functions
// so every phrasing (growth, decline, flat, one platform doing all the work)
// is unit tested.

import { formatNumber, formatSigned } from './format';
import { platformName } from './platforms';

export interface OverviewNumbers {
  days: number;
  combinedAudience: number;
  gained: number;
  topPlatform: string | null;
  topPlatformGained: number;
}

/**
 * The headline split around its lead number, so the page can count that number
 * up while the words stay still. `before + formatNumber(count) + after` is the
 * whole sentence; `count` is null when the sentence has no number in it.
 */
export interface HeadlineParts {
  before: string;
  count: number | null;
  after: string;
}

function fanWord(count: number): string {
  return count === 1 ? 'fan' : 'fans';
}

export function headlineParts(o: OverviewNumbers): HeadlineParts {
  const period = `in the last ${o.days} ${o.days === 1 ? 'day' : 'days'}`;

  if (o.gained > 0) {
    let after = ` ${fanWord(o.gained)} ${period}.`;
    if (o.topPlatform) {
      const name = platformName(o.topPlatform);
      const amount = formatSigned(o.topPlatformGained);
      // "Most of them" is only true when the top platform brought more than half.
      after +=
        o.topPlatformGained * 2 > o.gained
          ? ` Most of them came from ${name} (${amount}).`
          : ` ${name} brought the most (${amount}).`;
    }
    return { before: 'You picked up ', count: o.gained, after };
  }

  if (o.gained < 0) {
    let after = ` ${fanWord(-o.gained)} ${period}.`;
    if (o.topPlatform) {
      after += ` ${platformName(o.topPlatform)} still grew (${formatSigned(o.topPlatformGained)}).`;
    }
    return { before: 'Your audience is down ', count: -o.gained, after };
  }

  return { before: `Your audience held steady ${period}.`, count: null, after: '' };
}

export function headline(o: OverviewNumbers): string {
  const { before, count, after } = headlineParts(o);
  return before + (count === null ? '' : formatNumber(count)) + after;
}

export function audienceLine(o: Pick<OverviewNumbers, 'combinedAudience'>, platformCount: number): string {
  const where = `across ${platformCount} ${platformCount === 1 ? 'platform' : 'platforms'}`;
  return (
    `${formatNumber(o.combinedAudience)} fans ${where} today. ` +
    'Someone who follows you in two places counts twice.'
  );
}
