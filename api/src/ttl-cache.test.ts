import { describe, expect, it } from 'vitest';

import { TtlCache } from './ttl-cache.js';

describe('TtlCache', () => {
  it('serves the last good answer when a refresh fails, until it is too old', async () => {
    let now = 0;
    let fail = false;
    let calls = 0;
    const cache = new TtlCache(1000, () => now, 5000);
    const load = async () => {
      calls++;
      if (fail) throw new Error('feed is down');
      return `answer ${calls}`;
    };

    expect(await cache.remember('k', load)).toBe('answer 1');

    fail = true;
    now = 1500; // expired, so it refreshes, fails, and falls back
    expect(await cache.remember('k', load)).toBe('answer 1');

    // The fallback is not cached for a whole TTL: the very next request retries.
    now = 1501;
    await cache.remember('k', load);
    expect(calls).toBe(3);

    now = 6001; // the good answer (fetched at 0) is now older than staleMs
    await expect(cache.remember('k', load)).rejects.toThrow('feed is down');
  });

  it('does not invent an answer when there never was a good one', async () => {
    const cache = new TtlCache(1000, () => 0, 5000);
    await expect(
      cache.remember('k', async () => {
        throw new Error('nothing yet');
      }),
    ).rejects.toThrow('nothing yet');
  });
});
