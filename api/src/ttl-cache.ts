interface Entry {
  expires: number;
  value: Promise<unknown>;
}

/**
 * Remembers each answer for `ttlMs`. Used for BigQuery results and for news.
 *
 * It caches the promise, not the result, so identical requests that arrive at
 * the same moment share one call to the slow thing. A failure is never kept:
 * the next request tries again.
 *
 * With `staleMs` set, a failed refresh falls back to the last good answer for
 * up to that long after it was fetched. A news site having a bad hour then
 * leaves the old headlines on screen instead of an empty page.
 */
export class TtlCache {
  private readonly entries = new Map<string, Entry>();
  private readonly lastGood = new Map<string, { value: unknown; at: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
    private readonly staleMs = 0,
  ) {}

  remember<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.expires > this.now()) return hit.value as Promise<T>;

    const value = load().then(
      (result) => {
        this.lastGood.set(key, { value: result, at: this.now() });
        return result;
      },
      (error: unknown) => {
        // Drop the failed entry first, so the next request retries instead of
        // being served the fallback for a whole TTL.
        this.entries.delete(key);
        const good = this.lastGood.get(key);
        if (good && this.now() - good.at <= this.staleMs) return good.value as T;
        throw error;
      },
    );
    this.entries.set(key, { expires: this.now() + this.ttlMs, value });
    return value;
  }
}
