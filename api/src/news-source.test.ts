import { describe, expect, it } from 'vitest';

import { NEWS_FIXTURE } from './config.js';
import { CachedNewsSource, FeedNewsSource, FixtureNewsSource, type NewsSource } from './news-source.js';

const NOW = new Date('2026-10-06T12:00:00Z');

function feedXml(items: { title: string; path: string; date: string }[]): string {
  return `<rss><channel>${items
    .map((i) => `<item><title>${i.title}</title><link>https://example.com/${i.path}</link><pubDate>${i.date}</pubDate></item>`)
    .join('')}</channel></rss>`;
}

const feeds = [
  { name: 'Alpha', url: 'https://alpha.test/feed' },
  { name: 'Beta', url: 'https://beta.test/feed' },
];

/** A fake `fetch`: each URL maps to a Response, or a function that decides (and can hang or throw). */
function fakeFetch(routes: Record<string, Response | ((init: RequestInit | undefined) => Promise<Response>)>) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const route = routes[url];
    if (!route) throw new Error(`no route for ${url}`);
    return typeof route === 'function' ? route(init) : route.clone();
  }) as typeof fetch;
  return { fetchFn, calls };
}

const alphaXml = feedXml([
  { title: 'Spotify news', path: 'a1', date: '2026-10-05T10:00:00Z' },
  { title: 'Alpha older', path: 'a2', date: '2026-10-04T10:00:00Z' },
]);
const betaXml = feedXml([{ title: 'TikTok news', path: 'b1', date: '2026-10-05T12:00:00Z' }]);

describe('FeedNewsSource', () => {
  it('reads every feed and merges them newest first, tagged by platform', async () => {
    const { fetchFn } = fakeFetch({
      'https://alpha.test/feed': new Response(alphaXml),
      'https://beta.test/feed': new Response(betaXml),
    });
    const result = await new FeedNewsSource(feeds, { fetchFn, now: () => NOW }).latest(10);
    expect(result.live).toBe(true);
    expect(result.items.map((i) => [i.source, i.platform])).toEqual([
      ['Beta', 'tiktok'],
      ['Alpha', 'spotify'],
      ['Alpha', null],
    ]);
  });

  it('identifies itself and asks for feeds', async () => {
    const { fetchFn, calls } = fakeFetch({ 'https://alpha.test/feed': new Response(alphaXml) });
    await new FeedNewsSource([feeds[0]!], { fetchFn, now: () => NOW }).latest(5);
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('FanInsightsLite');
    expect(headers.Accept).toContain('rss');
  });

  it('keeps going when one feed returns an error page', async () => {
    const { fetchFn } = fakeFetch({
      'https://alpha.test/feed': new Response('Server error', { status: 500 }),
      'https://beta.test/feed': new Response(betaXml),
    });
    const result = await new FeedNewsSource(feeds, { fetchFn, now: () => NOW }).latest(10);
    expect(result.items.map((i) => i.source)).toEqual(['Beta']);
  });

  it('keeps going when one feed returns something that is not a feed', async () => {
    const { fetchFn } = fakeFetch({
      'https://alpha.test/feed': new Response('<html><body>Please enable cookies</body></html>'),
      'https://beta.test/feed': new Response(betaXml),
    });
    const result = await new FeedNewsSource(feeds, { fetchFn, now: () => NOW }).latest(10);
    expect(result.items).toHaveLength(1);
  });

  it('gives up on a feed that is too slow, without waiting for it', async () => {
    const hangs = (init: RequestInit | undefined) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('timed out')));
      });
    const { fetchFn } = fakeFetch({ 'https://alpha.test/feed': hangs, 'https://beta.test/feed': new Response(betaXml) });
    const started = Date.now();
    const result = await new FeedNewsSource(feeds, { fetchFn, now: () => NOW, timeoutMs: 30 }).latest(10);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(result.items.map((i) => i.source)).toEqual(['Beta']);
  });

  it('skips a feed bigger than the size cap', async () => {
    const { fetchFn } = fakeFetch({
      'https://alpha.test/feed': new Response(alphaXml + ' '.repeat(5000)),
      'https://beta.test/feed': new Response(betaXml),
    });
    const result = await new FeedNewsSource(feeds, { fetchFn, now: () => NOW, maxBytes: 2000 }).latest(10);
    expect(result.items.map((i) => i.source)).toEqual(['Beta']);
  });

  it('throws when every feed fails, so nothing empty gets cached', async () => {
    const { fetchFn } = fakeFetch({
      'https://alpha.test/feed': new Response('nope', { status: 503 }),
      'https://beta.test/feed': new Response('nope', { status: 503 }),
    });
    await expect(new FeedNewsSource(feeds, { fetchFn, now: () => NOW }).latest(10)).rejects.toThrow('No news feed answered');
  });
});

describe('FixtureNewsSource', () => {
  it('returns clearly labeled placeholders that look fresh', async () => {
    const result = await new FixtureNewsSource(NEWS_FIXTURE, () => NOW).latest(3);
    expect(result.live).toBe(false);
    expect(result.items).toHaveLength(3);
    expect(result.items.every((i) => i.title.startsWith('Sample headline:'))).toBe(true);
    expect(result.items[0]?.publishedAt).toBe('2026-10-06T10:00:00.000Z');
  });
});

describe('CachedNewsSource', () => {
  it('fetches once for any number of requests, whatever limit each asks for', async () => {
    let calls = 0;
    const inner: NewsSource = {
      latest: async () => {
        calls++;
        return {
          live: true,
          items: Array.from({ length: 30 }, (_, i) => ({
            title: `Item ${i}`,
            url: `https://example.com/${i}`,
            source: 'S',
            publishedAt: NOW.toISOString(),
            platform: null,
          })),
        };
      },
    };
    const cached = new CachedNewsSource(inner, 60_000, 0);
    expect((await cached.latest(5)).items).toHaveLength(5);
    expect((await cached.latest(12)).items).toHaveLength(12);
    expect(calls).toBe(1);
  });

  it('keeps showing the last good headlines when a refresh fails', async () => {
    let now = 0;
    let fail = false;
    const inner: NewsSource = {
      latest: async () => {
        if (fail) throw new Error('all feeds down');
        return { live: true, items: [{ title: 'Kept', url: 'https://example.com/k', source: 'S', publishedAt: NOW.toISOString(), platform: null }] };
      },
    };
    const cached = new CachedNewsSource(inner, 1000, 10_000, () => now);
    await cached.latest(5);
    fail = true;
    now = 2000;
    expect((await cached.latest(5)).items.map((i) => i.title)).toEqual(['Kept']);
  });
});
