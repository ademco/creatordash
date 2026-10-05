import { describe, expect, it } from 'vitest';

import { CachedDataSource } from './cached-datasource.js';
import type { DataSource } from './datasource.js';

function countingSource() {
  const counts = { newestDate: 0, audienceSince: 0 };
  let fail = false;
  const source: DataSource = {
    newestDate: async () => {
      counts.newestDate++;
      if (fail) throw new Error('BigQuery is down');
      return '2026-09-30';
    },
    audienceSince: async () => {
      counts.audienceSince++;
      return [];
    },
    contentSince: async () => [],
    info: async () => ({ source: 'test', sample: false, newestDate: null }),
  };
  return { source, counts, setFail: (value: boolean) => (fail = value) };
}

describe('CachedDataSource', () => {
  it('merges simultaneous identical requests into one call', async () => {
    const { source, counts } = countingSource();
    const cached = new CachedDataSource(source, 60_000);
    await Promise.all([cached.newestDate(), cached.newestDate(), cached.newestDate()]);
    expect(counts.newestDate).toBe(1);
  });

  it('caches per argument and expires after the TTL', async () => {
    let now = 0;
    const { source, counts } = countingSource();
    const cached = new CachedDataSource(source, 1000, () => now);
    await cached.audienceSince('2026-09-01');
    await cached.audienceSince('2026-09-01');
    await cached.audienceSince('2026-07-03');
    expect(counts.audienceSince).toBe(2);
    now = 1001;
    await cached.audienceSince('2026-09-01');
    expect(counts.audienceSince).toBe(3);
  });

  it('does not keep failures, so the next request retries', async () => {
    const { source, counts, setFail } = countingSource();
    const cached = new CachedDataSource(source, 60_000);
    setFail(true);
    await expect(cached.newestDate()).rejects.toThrow('BigQuery is down');
    setFail(false);
    expect(await cached.newestDate()).toBe('2026-09-30');
    expect(counts.newestDate).toBe(2);
  });
});
