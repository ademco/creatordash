import { describe, expect, it } from 'vitest';

import { cleanText, mergeNews, parseFeed, safeUrl, tagPlatform, type NewsItem } from './news.js';

const rss = `<?xml version="1.0"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Site</title>
  <item>
    <title><![CDATA[Spotify adds a <b>new</b> payout tier &amp; more]]></title>
    <link>https://example.com/spotify-payout?utm_source=rss</link>
    <pubDate>Mon, 05 Oct 2026 14:03:00 GMT</pubDate>
    <description>Long article text that we never keep.</description>
  </item>
  <item>
    <title>It&#8217;s a TikTok world &mdash; Q&amp;A</title>
    <link>https://example.com/tiktok-world</link>
    <dc:date>2026-10-04T09:00:00Z</dc:date>
  </item>
  <item><title>No date on this one</title><link>https://example.com/nodate</link></item>
  <item><title>Bad link</title><link>javascript:alert(1)</link><pubDate>Mon, 05 Oct 2026 14:03:00 GMT</pubDate></item>
</channel></rss>`;

const atom = `<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title type="html">Twitch changes its rules</title>
    <link rel="self" href="https://example.com/self"/>
    <link rel="alternate" href="https://example.com/twitch-rules"/>
    <updated>2026-10-05T10:00:00Z</updated>
  </entry>
</feed>`;

describe('parseFeed', () => {
  it('reads RSS: CDATA, tags, entities, and a dc:date fallback', () => {
    const items = parseFeed(rss, 'Site');
    expect(items.map((i) => i.title)).toEqual(['Spotify adds a new payout tier & more', 'It’s a TikTok world — Q&A']);
    expect(items[0]).toMatchObject({
      source: 'Site',
      publishedAt: '2026-10-05T14:03:00.000Z',
      platform: 'spotify',
    });
    expect(items[1]?.publishedAt).toBe('2026-10-04T09:00:00.000Z');
  });

  it('skips items with no date or a non-web link, and never keeps the article text', () => {
    const items = parseFeed(rss, 'Site');
    expect(items).toHaveLength(2);
    expect(JSON.stringify(items)).not.toContain('Long article text');
  });

  it('reads Atom and picks the alternate link', () => {
    expect(parseFeed(atom, 'Atom Site')).toEqual([
      {
        title: 'Twitch changes its rules',
        url: 'https://example.com/twitch-rules',
        source: 'Atom Site',
        publishedAt: '2026-10-05T10:00:00.000Z',
        platform: 'twitch',
      },
    ]);
  });

  it('copes with a feed that has a single item', () => {
    const one = `<rss><channel><item><title>Only one</title><link>https://example.com/1</link><pubDate>2026-10-05T10:00:00Z</pubDate></item></channel></rss>`;
    expect(parseFeed(one, 'S')).toHaveLength(1);
  });

  it('returns nothing for junk, HTML, or an empty body', () => {
    expect(parseFeed('', 'S')).toEqual([]);
    expect(parseFeed('<html><body>Not a feed</body></html>', 'S')).toEqual([]);
    expect(parseFeed('{"json": true}', 'S')).toEqual([]);
    expect(parseFeed('<rss><channel><item><title>oops', 'S')).toEqual([]);
  });

  it('does not expand entity bombs', () => {
    const bomb = `<?xml version="1.0"?><!DOCTYPE lol [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;">]>
      <rss><channel><item><title>&b;&b;&b;&b;</title><link>https://example.com/x</link><pubDate>2026-10-05T10:00:00Z</pubDate></item></channel></rss>`;
    const items = parseFeed(bomb, 'S');
    expect((items[0]?.title.length ?? 0) < 100).toBe(true);
  });

  it('keeps only the first 30 items of a huge feed', () => {
    const many = `<rss><channel>${Array.from(
      { length: 80 },
      (_, i) => `<item><title>Item ${i}</title><link>https://example.com/${i}</link><pubDate>2026-10-05T10:00:00Z</pubDate></item>`,
    ).join('')}</channel></rss>`;
    expect(parseFeed(many, 'S')).toHaveLength(30);
  });
});

describe('cleanText and safeUrl', () => {
  it('strips tags, decodes entities, and tidies whitespace', () => {
    expect(cleanText('  A&nbsp;<i>big</i>\n  deal &#x2014; &#8220;wow&#8221;  ')).toBe('A big deal — “wow”');
    expect(cleanText('Unknown &madeup; entity')).toBe('Unknown &madeup; entity');
  });

  it('caps a very long title', () => {
    expect(cleanText('x'.repeat(500))).toHaveLength(200);
  });

  it('allows only http and https links', () => {
    expect(safeUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,hi')).toBeNull();
    expect(safeUrl('not a url')).toBeNull();
  });
});

describe('tagPlatform', () => {
  it('tags the five platforms by whole word, any case', () => {
    expect(tagPlatform('SPOTIFY raises prices')).toBe('spotify');
    expect(tagPlatform('New YouTube Shorts tools')).toBe('youtube');
    expect(tagPlatform('How You Tube pays creators')).toBe('youtube');
    expect(tagPlatform('Tik Tok deal closes')).toBe('tiktok');
    expect(tagPlatform('Twitch bans something')).toBe('twitch');
  });

  it('does not match inside other words', () => {
    expect(tagPlatform('Twitchy fans react')).toBeNull();
    expect(tagPlatform('A spotifyish sound')).toBeNull();
  });

  it('tags Kick only in streaming contexts, never "kick drum"', () => {
    expect(tagPlatform('Kick streamers sign big deals')).toBe('kick');
    expect(tagPlatform('Streamers move to Kick')).toBe('kick');
    expect(tagPlatform('Kick.com announces payouts')).toBe('kick');
    expect(tagPlatform('Kick drum sample pack for streaming producers')).toBeNull();
    expect(tagPlatform('Kick off the week with new releases')).toBeNull();
    expect(tagPlatform('Quick tips to kick a habit')).toBeNull();
  });

  it('picks the platform named first when there are several', () => {
    expect(tagPlatform('Creators leave Twitch and YouTube for Kick')).toBe('twitch');
    expect(tagPlatform('TikTok sends listeners to Spotify')).toBe('tiktok');
  });

  it('returns null for general music news', () => {
    expect(tagPlatform('Label signs three new acts')).toBeNull();
  });
});

describe('mergeNews', () => {
  const NOW = new Date('2026-10-06T12:00:00Z');
  const item = (title: string, url: string, source: string, publishedAt: string): NewsItem => ({
    title,
    url,
    source,
    publishedAt,
    platform: null,
  });

  it('sorts newest first and applies the limit', () => {
    const merged = mergeNews(
      [
        [item('Old', 'https://a.com/1', 'A', '2026-10-01T00:00:00Z'), item('New', 'https://a.com/2', 'A', '2026-10-05T00:00:00Z')],
        [item('Middle', 'https://b.com/1', 'B', '2026-10-03T00:00:00Z')],
      ],
      { limit: 2, now: NOW },
    );
    expect(merged.map((i) => i.title)).toEqual(['New', 'Middle']);
  });

  it('drops headlines older than the cutoff', () => {
    const merged = mergeNews([[item('Ancient', 'https://a.com/1', 'A', '2026-09-01T00:00:00Z')]], { limit: 5, now: NOW });
    expect(merged).toEqual([]);
  });

  it('removes duplicates by link (ignoring tracking) and by title', () => {
    const merged = mergeNews(
      [
        [item('Same story', 'https://a.com/x?utm_source=rss#top', 'A', '2026-10-05T10:00:00Z')],
        [
          item('Different words', 'https://a.com/x/', 'B', '2026-10-05T09:00:00Z'),
          item('Same   STORY!', 'https://b.com/other', 'B', '2026-10-05T08:00:00Z'),
        ],
      ],
      { limit: 5, now: NOW },
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.source).toBe('A');
  });

  it('caps how many come from one site, so a chatty feed cannot take over', () => {
    const chatty = Array.from({ length: 10 }, (_, i) =>
      item(`Chatty ${i}`, `https://a.com/${i}`, 'A', `2026-10-05T${String(10 + i).padStart(2, '0')}:00:00Z`),
    );
    const quiet = [item('Quiet', 'https://b.com/1', 'B', '2026-10-02T00:00:00Z')];
    const merged = mergeNews([chatty, quiet], { limit: 10, now: NOW, perSource: 3 });
    expect(merged.filter((i) => i.source === 'A')).toHaveLength(3);
    expect(merged.some((i) => i.source === 'B')).toBe(true);
  });
});
