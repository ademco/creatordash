import { useQuery } from '@apollo/client/react';
import { useState, type CSSProperties } from 'react';

import { NEWS_LIMIT, NEWS_QUERY, type NewsItemData } from '../graphql/news';
import { relativeTime, safeHref } from '../lib/news';
import { usePrefersReducedMotion } from '../lib/useThemeColors';

/** How long each headline takes to scroll past. */
const SECONDS_PER_ITEM = 7;

function TickerItem({ item, now, hidden }: { item: NewsItemData; now: Date; hidden?: boolean }) {
  const href = safeHref(item.url);
  const dot = (
    <span
      className="dot"
      style={{ background: item.platform ? `var(--platform-${item.platform})` : 'var(--muted)' }}
      aria-hidden="true"
    />
  );
  const text = (
    <>
      <span className="ticker-title">{item.title}</span>
      <span className="ticker-meta">
        {item.source} · {relativeTime(item.publishedAt, now)}
      </span>
    </>
  );
  return (
    // The second copy of the list (for a seamless loop) is hidden from screen
    // readers and the Tab key, so each headline is announced and focused once.
    <li className="ticker-item" aria-hidden={hidden || undefined}>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" tabIndex={hidden ? -1 : undefined}>
          {dot}
          {text}
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      ) : (
        <span className="ticker-plain">
          {dot}
          {text}
        </span>
      )}
    </li>
  );
}

/**
 * A strip of headlines under the top bar. It scrolls slowly; hovering or
 * focusing it pauses it, and there is a Pause button (moving text that lasts
 * more than a few seconds must be stoppable). With reduced motion on it is a
 * plain row you can scroll. If the news cannot be loaded, it is not shown at
 * all: the page works the same without it.
 */
export function NewsTicker() {
  const { data, loading } = useQuery(NEWS_QUERY, { variables: { limit: NEWS_LIMIT } });
  const reducedMotion = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);

  // Keep the strip's height while loading, so the page does not jump when it fills in.
  if (loading && !data) return <div className="ticker" aria-hidden="true" />;

  const news = data?.news;
  if (!news || news.items.length === 0) return null;

  const now = new Date();
  const style = { '--ticker-seconds': `${news.items.length * SECONDS_PER_ITEM}s` } as CSSProperties;

  return (
    <section className="ticker" aria-label="Music and creator news">
      <div className="page ticker-inner">
        <span className="ticker-label">{news.live ? 'Around the web' : 'Offline sample'}</span>
        <div className={paused ? 'ticker-viewport is-paused' : 'ticker-viewport'}>
          <ul className="ticker-track" style={style}>
            {news.items.map((item) => (
              <TickerItem key={item.url} item={item} now={now} />
            ))}
            {!reducedMotion &&
              news.items.map((item) => <TickerItem key={`again-${item.url}`} item={item} now={now} hidden />)}
          </ul>
        </div>
        {!reducedMotion && (
          <button
            type="button"
            className="ticker-pause"
            onClick={() => setPaused((value) => !value)}
            aria-label={paused ? 'Resume the news ticker' : 'Pause the news ticker'}
          >
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
              {paused ? (
                <path d="M2 1l9 5-9 5z" fill="currentColor" />
              ) : (
                <path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor" />
              )}
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
