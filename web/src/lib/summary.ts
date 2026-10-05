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

function fans(count: number): string {
  return `${formatNumber(count)} ${count === 1 ? 'fan' : 'fans'}`;
}

export function headline(o: OverviewNumbers): string {
  const period = `in the last ${o.days} ${o.days === 1 ? 'day' : 'days'}`;

  if (o.gained > 0) {
    const first = `You picked up ${fans(o.gained)} ${period}.`;
    if (!o.topPlatform) return first;
    const name = platformName(o.topPlatform);
    const amount = formatSigned(o.topPlatformGained);
    // "Most of them" is only true when the top platform brought more than half.
    if (o.topPlatformGained * 2 > o.gained) return `${first} Most of them came from ${name} (${amount}).`;
    return `${first} ${name} brought the most (${amount}).`;
  }

  if (o.gained < 0) {
    const first = `Your audience is down ${fans(-o.gained)} ${period}.`;
    if (!o.topPlatform) return first;
    return `${first} ${platformName(o.topPlatform)} still grew (${formatSigned(o.topPlatformGained)}).`;
  }

  return `Your audience held steady ${period}.`;
}

export function audienceLine(o: Pick<OverviewNumbers, 'combinedAudience'>, platformCount: number): string {
  const where = `across ${platformCount} ${platformCount === 1 ? 'platform' : 'platforms'}`;
  return (
    `${formatNumber(o.combinedAudience)} followers, subscribers, and monthly listeners ${where} today. ` +
    'Someone who follows you in two places counts twice.'
  );
}
