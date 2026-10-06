import { useQuery } from '@apollo/client/react';
import type { CSSProperties } from 'react';

import { NEWS_LIMIT, NEWS_QUERY } from '../graphql/news';
import { panelItems, relativeTime, safeHref } from '../lib/news';
import { platformName } from '../lib/platforms';

const PANEL_COUNT = 6;

/**
 * "Around the web": the freshest headlines about the platforms the artist is
 * on, then general music news. It asks for the same query as the ticker, so
 * Apollo makes one request for both. It renders nothing if there is no news.
 */
export function AroundTheWeb({ sample }: { sample: boolean }) {
  const { data } = useQuery(NEWS_QUERY, { variables: { limit: NEWS_LIMIT } });
  const news = data?.news;
  if (!news || news.items.length === 0) return null;

  const now = new Date();
  const items = panelItems(news.items, PANEL_COUNT);

  return (
    <div className="band" style={{ '--i': 3 } as CSSProperties}>
      <div className="page band-inner">
        <section className="section" aria-labelledby="web-title">
          <h2 id="web-title">Around the web</h2>
          <p className="section-note">
            {news.live
              ? `Fresh music and creator news, newest first for the platforms you are on. Each link opens the story on the publisher’s site.${
                  sample ? ' These headlines are real; the fan numbers above are made up.' : ''
                }`
              : 'Offline sample headlines. No news feed is connected, so these are placeholders, not real news.'}
          </p>
          <ul className="news-list">
            {items.map((item) => {
              const href = safeHref(item.url);
              return (
                <li key={item.url} className="news-item">
                  <p className="news-tag">
                    <span
                      className="dot"
                      style={{ background: item.platform ? `var(--platform-${item.platform})` : 'var(--muted)' }}
                      aria-hidden="true"
                    />
                    {item.platform ? platformName(item.platform) : 'Music news'}
                  </p>
                  <p className="news-title">
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {item.title}
                        <span className="visually-hidden"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      item.title
                    )}
                  </p>
                  <p className="news-meta">
                    {item.source} · {relativeTime(item.publishedAt, now)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
