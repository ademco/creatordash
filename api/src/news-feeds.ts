// The news feeds the API reads. This is a fixed list in code on purpose: the
// server only ever fetches these addresses, never one that came from a visitor,
// so nobody can use the API to make our server fetch something else.
//
// Not every feed needs to be alive. A feed that is down or has moved is skipped
// and the others still fill the list (see FeedNewsSource). To add one, append a
// line here; to check one, run the API and ask for `{ news { items { source } } }`.

import type { NewsFeed } from './news-source.js';

export const NEWS_FEEDS: NewsFeed[] = [
  { name: 'Music Business Worldwide', url: 'https://www.musicbusinessworldwide.com/feed/' },
  { name: 'Billboard', url: 'https://www.billboard.com/feed/' },
  { name: 'Digital Music News', url: 'https://www.digitalmusicnews.com/feed/' },
  { name: 'Stereogum', url: 'https://www.stereogum.com/feed/' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
];
