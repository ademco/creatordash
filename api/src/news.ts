// Turns news feeds (RSS or Atom) into a short list of headlines. Everything
// here is pure, so every odd feed we can think of is a unit test, and none of it
// touches the network. Only the headline, source, date, and link are kept: the
// story itself stays with the publisher.

import { XMLParser } from 'fast-xml-parser';

export interface NewsItem {
  title: string;
  url: string;
  /** The site it came from, e.g. "Music Business Worldwide". */
  source: string;
  /** ISO 8601, e.g. 2026-10-05T14:03:00.000Z */
  publishedAt: string;
  /** spotify, youtube, twitch, kick, or tiktok when the headline is about one; otherwise null. */
  platform: string | null;
}

export interface NewsResult {
  /** False for the built-in offline sample headlines. */
  live: boolean;
  items: NewsItem[];
}

const MAX_TITLE_LENGTH = 200;
const MAX_ITEMS_PER_FEED = 30;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

/** Decodes the handful of entities headlines actually use, plus numeric ones. Unknown ones are left alone. */
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith('#')) {
      const point = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Plain text from a headline that may contain tags and entities. */
export function cleanText(raw: string): string {
  const withoutTags = raw.replace(/<[^>]*>/g, ' ');
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH);
}

/** Only web links are kept: no javascript:, data:, or file: addresses reach the page. */
export function safeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

// Platform names, as whole words. Kick is the awkward one: "kick drum" and
// "kick off" must not count, so it only matches in streaming contexts.
const PLATFORM_PATTERNS: [string, RegExp][] = [
  ['spotify', /\bspotify\b/i],
  ['youtube', /\byou ?tube\b/i],
  ['twitch', /\btwitch\b/i],
  ['tiktok', /\btik ?tok\b/i],
  ['kick', /\bkick\.com\b/i],
  ['kick', /\bKick (?:stream\w*|platform|creators?)\b/],
  ['kick', /\b(?:on|to|from|joins?|leaves?|rival|vs\.?) Kick\b/],
];

/** The platform a headline is about, or null. If it names several, the first one named wins. */
export function tagPlatform(title: string): string | null {
  let best: { platform: string; index: number } | null = null;
  for (const [platform, pattern] of PLATFORM_PATTERNS) {
    const index = title.search(pattern);
    if (index !== -1 && (!best || index < best.index)) best = { platform, index };
  }
  return best?.platform ?? null;
}

// Feeds come in two dialects. isArray makes the tags that can repeat always
// arrays, so the code below does not care whether a feed had one item or fifty.
// Entities are decoded by cleanText, not the parser, so a hostile feed cannot
// use the parser's entity expansion to blow up memory.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
  isArray: (name) => name === 'item' || name === 'entry' || name === 'link',
});

/** Text of a parsed XML node: a string, a number, or an object with #text. */
function textOf(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (node && typeof node === 'object' && '#text' in node) return textOf((node as { '#text': unknown })['#text']);
  return '';
}

/** RSS gives <link>text</link>; Atom gives <link href="..." rel="alternate"/>. */
function linkOf(links: unknown): string {
  if (!Array.isArray(links)) return '';
  for (const link of links) {
    if (typeof link === 'string') return link;
    if (link && typeof link === 'object') {
      const { '@_href': href, '@_rel': rel } = link as Record<string, unknown>;
      if (typeof href === 'string' && (rel === undefined || rel === 'alternate')) return href;
      if ('#text' in link) return textOf(link);
    }
  }
  return '';
}

/** Parses one feed. Anything it cannot make sense of (bad XML, no date, no web link) is skipped, never thrown. */
export function parseFeed(xml: string, source: string): NewsItem[] {
  let doc: Record<string, any>;
  try {
    doc = parser.parse(xml) as Record<string, any>;
  } catch {
    return [];
  }

  const raw: unknown[] = doc.rss?.channel?.item ?? doc['rdf:RDF']?.item ?? doc.feed?.entry ?? [];
  const items: NewsItem[] = [];
  for (const entry of raw.slice(0, MAX_ITEMS_PER_FEED) as Record<string, unknown>[]) {
    const title = cleanText(textOf(entry.title));
    const url = safeUrl(linkOf(entry.link));
    const published = new Date(textOf(entry.pubDate ?? entry['dc:date'] ?? entry.published ?? entry.updated).trim());
    if (!title || !url || Number.isNaN(published.getTime())) continue;
    items.push({ title, url, source, publishedAt: published.toISOString(), platform: tagPlatform(title) });
  }
  return items;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The same story, however the site spells the link: no #fragment, no tracking parameters, no trailing slash. */
function storyKey(item: NewsItem): string {
  try {
    const url = new URL(item.url);
    for (const name of [...url.searchParams.keys()]) {
      if (name.startsWith('utm_') || name === 'fbclid') url.searchParams.delete(name);
    }
    url.hash = '';
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return item.url;
  }
}

function titleKey(item: NewsItem): string {
  return item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export interface MergeOptions {
  limit: number;
  now: Date;
  /** Older headlines are dropped. */
  maxAgeDays?: number;
  /** At most this many from one site, so a chatty feed cannot fill the whole list. */
  perSource?: number;
}

/** Combines feeds: drops old and duplicate headlines, caps each site, newest first. */
export function mergeNews(lists: NewsItem[][], { limit, now, maxAgeDays = 14, perSource = 4 }: MergeOptions): NewsItem[] {
  const oldest = now.getTime() - maxAgeDays * DAY_MS;
  const newestFirst = lists
    .flat()
    .filter((item) => new Date(item.publishedAt).getTime() >= oldest)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const seen = new Set<string>();
  const perSourceCount = new Map<string, number>();
  const merged: NewsItem[] = [];
  for (const item of newestFirst) {
    const keys = [`url:${storyKey(item)}`, `title:${titleKey(item)}`];
    if (keys.some((key) => seen.has(key))) continue;
    const fromSource = perSourceCount.get(item.source) ?? 0;
    if (fromSource >= perSource) continue;
    keys.forEach((key) => seen.add(key));
    perSourceCount.set(item.source, fromSource + 1);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged;
}
