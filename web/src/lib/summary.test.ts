import { describe, expect, it } from 'vitest';

import { formatCompact, formatMultiple, formatShortDate, formatSigned } from './format';
import { audienceLine, headline } from './summary';

const base = { days: 90, combinedAudience: 56295, gained: 0, topPlatform: null, topPlatformGained: 0 };

describe('headline', () => {
  it('says "most of them" when one platform brought more than half', () => {
    expect(headline({ ...base, days: 30, gained: 3414, topPlatform: 'tiktok', topPlatformGained: 2211 })).toBe(
      'You picked up 3,414 fans in the last 30 days. Most of them came from TikTok (+2,211).',
    );
  });

  it('says "brought the most" when the top platform brought less than half', () => {
    expect(headline({ ...base, gained: 11041, topPlatform: 'spotify', topPlatformGained: 4755 })).toBe(
      'You picked up 11,041 fans in the last 90 days. Spotify brought the most (+4,755).',
    );
  });

  it('handles a drop, with or without a platform that still grew', () => {
    expect(headline({ ...base, gained: -120 })).toBe('Your audience is down 120 fans in the last 90 days.');
    expect(headline({ ...base, gained: -120, topPlatform: 'kick', topPlatformGained: 15 })).toBe(
      'Your audience is down 120 fans in the last 90 days. Kick still grew (+15).',
    );
  });

  it('handles no change and singulars', () => {
    expect(headline({ ...base, days: 1 })).toBe('Your audience held steady in the last 1 day.');
    expect(headline({ ...base, gained: 1, topPlatform: 'youtube', topPlatformGained: 1 })).toBe(
      'You picked up 1 fan in the last 90 days. Most of them came from YouTube (+1).',
    );
  });
});

describe('audienceLine', () => {
  it('states the combined audience and that people can count twice', () => {
    expect(audienceLine(base, 5)).toBe(
      '56,295 fans across 5 platforms today. ' +
        'Someone who follows you in two places counts twice.',
    );
  });
});

describe('formatting', () => {
  it('formats signed, compact, multiples, and dates', () => {
    expect(formatSigned(1204)).toBe('+1,204');
    expect(formatSigned(-15)).toBe('−15');
    expect(formatCompact(12345)).toBe('12.3K');
    expect(formatCompact(2000, true)).toBe('+2K');
    expect(formatMultiple(4.123)).toBe('4.1×');
    expect(formatShortDate('2026-09-30')).toBe('Sep 30');
  });
});
