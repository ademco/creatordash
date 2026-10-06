import type { DataSource } from './datasource.js';
import { TtlCache } from './ttl-cache.js';
import type { AudienceRow, ContentRow, DataInfo } from './types.js';

/**
 * Wraps a data source and remembers each answer for `ttlMs`.
 *
 * One dashboard load asks for four things at once, and each starts by asking
 * for the newest date. Without this, that is about eight BigQuery queries per
 * page view, each taking around a second. Caching the promise (not the result)
 * also merges identical requests that arrive at the same moment into one query.
 * The data changes at most daily, so a few minutes of staleness is fine.
 */
export class CachedDataSource implements DataSource {
  private readonly cache: TtlCache;

  constructor(
    private readonly inner: DataSource,
    ttlMs: number,
    now: () => number = Date.now,
  ) {
    this.cache = new TtlCache(ttlMs, now);
  }

  newestDate(): Promise<string | null> {
    return this.cache.remember('newestDate', () => this.inner.newestDate());
  }

  audienceSince(since: string): Promise<AudienceRow[]> {
    return this.cache.remember(`audience:${since}`, () => this.inner.audienceSince(since));
  }

  contentSince(since: string): Promise<ContentRow[]> {
    return this.cache.remember(`content:${since}`, () => this.inner.contentSince(since));
  }

  info(): Promise<DataInfo> {
    return this.cache.remember('info', () => this.inner.info());
  }
}
