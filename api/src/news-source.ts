import { readFile } from 'node:fs/promises';

import { mergeNews, parseFeed, type NewsItem, type NewsResult } from './news.js';
import { TtlCache } from './ttl-cache.js';

/** Where headlines come from. Like DataSource, it hides the source from the resolvers. */
export interface NewsSource {
  latest(limit: number): Promise<NewsResult>;
}

export interface NewsFeed {
  name: string;
  url: string;
}

export interface FeedOptions {
  /** Injectable so tests never touch the network. */
  fetchFn?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  maxBytes?: number;
}

const USER_AGENT = 'FanInsightsLite/0.1 (portfolio project; https://github.com/ademco/creatordash)';

/** Reads a response body but gives up once it is bigger than `maxBytes`, so one huge file cannot eat our memory. */
async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text.length > maxBytes) throw new Error('feed is too large');
    return text;
  }
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      // Stop the download, but do not wait for the cleanup: refusing a feed must be instant.
      void reader.cancel().catch(() => undefined);
      throw new Error('feed is too large');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/**
 * Reads every feed at the same time and merges the answers. One feed being
 * slow, down, or broken costs only its own headlines. If every feed fails it
 * throws, so the cache keeps (or serves) the last good list instead of caching
 * an empty one.
 */
export class FeedNewsSource implements NewsSource {
  private readonly fetchFn: typeof fetch;
  private readonly now: () => Date;
  private readonly timeoutMs: number;
  private readonly maxBytes: number;

  constructor(
    private readonly feeds: NewsFeed[],
    options: FeedOptions = {},
  ) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? 3000;
    this.maxBytes = options.maxBytes ?? 1_000_000;
  }

  private async load(feed: NewsFeed): Promise<NewsItem[]> {
    const response = await this.fetchFn(feed.url, {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8',
      },
    });
    if (!response.ok) throw new Error(`${feed.name}: HTTP ${response.status}`);
    return parseFeed(await readLimited(response, this.maxBytes), feed.name);
  }

  async latest(limit: number): Promise<NewsResult> {
    const results = await Promise.allSettled(this.feeds.map((feed) => this.load(feed)));
    const lists = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    if (lists.length === 0) throw new Error('No news feed answered');
    return { live: true, items: mergeNews(lists, { limit, now: this.now() }) };
  }
}

interface FixtureEntry {
  title: string;
  url: string;
  source: string;
  hoursAgo: number;
  platform: string | null;
}

/**
 * Obvious placeholder headlines for offline development, tests, and CI. The
 * file says how many hours ago each was "published", so they look fresh
 * whenever you run the app. The result says `live: false`, so the page can
 * label them and fake text is never passed off as real news.
 */
export class FixtureNewsSource implements NewsSource {
  constructor(
    private readonly file: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async latest(limit: number): Promise<NewsResult> {
    const entries = JSON.parse(await readFile(this.file, 'utf8')) as FixtureEntry[];
    const now = this.now().getTime();
    const items = entries.slice(0, limit).map(
      ({ hoursAgo, ...rest }): NewsItem => ({
        ...rest,
        publishedAt: new Date(now - hoursAgo * 60 * 60 * 1000).toISOString(),
      }),
    );
    return { live: false, items };
  }
}

/** Fetching 5 feeds on every page view would be slow and impolite, so remember the list for a while. */
export class CachedNewsSource implements NewsSource {
  private readonly cache: TtlCache;

  /** Always fetch this many and cut the list down afterwards, so one cached copy serves every `limit`. */
  private static readonly FETCH_LIMIT = 30;

  constructor(
    private readonly inner: NewsSource,
    ttlMs: number,
    staleMs: number,
    now: () => number = Date.now,
  ) {
    this.cache = new TtlCache(ttlMs, now, staleMs);
  }

  async latest(limit: number): Promise<NewsResult> {
    const all = await this.cache.remember('latest', () => this.inner.latest(CachedNewsSource.FETCH_LIMIT));
    return { live: all.live, items: all.items.slice(0, limit) };
  }
}
