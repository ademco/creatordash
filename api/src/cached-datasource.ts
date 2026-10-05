import type { DataSource } from './datasource.js';
import type { AudienceRow, ContentRow, DataInfo } from './types.js';

interface Entry<T> {
  expires: number;
  value: Promise<T>;
}

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
  private readonly entries = new Map<string, Entry<unknown>>();

  constructor(
    private readonly inner: DataSource,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  private remember<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key) as Entry<T> | undefined;
    if (hit && hit.expires > this.now()) return hit.value;

    const value = load();
    this.entries.set(key, { expires: this.now() + this.ttlMs, value });
    // Never keep a failure: the next request should try again.
    value.catch(() => this.entries.delete(key));
    return value;
  }

  newestDate(): Promise<string | null> {
    return this.remember('newestDate', () => this.inner.newestDate());
  }

  audienceSince(since: string): Promise<AudienceRow[]> {
    return this.remember(`audience:${since}`, () => this.inner.audienceSince(since));
  }

  contentSince(since: string): Promise<ContentRow[]> {
    return this.remember(`content:${since}`, () => this.inner.contentSince(since));
  }

  info(): Promise<DataInfo> {
    return this.remember('info', () => this.inner.info());
  }
}
