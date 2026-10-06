import { formatLongDate, formatMultiple, formatNumber } from '../lib/format';
import { platformName, viewsWord } from '../lib/platforms';

interface Breakout {
  title: string;
  platform: string;
  contentType: string;
  publishedDate: string;
  views: number;
  typicalViews: number;
  multiple: number;
}

/** "What broke out": content that did far better than usual, biggest jump first. */
export function BreakoutList({ breakouts, days }: { breakouts: Breakout[]; days: number }) {
  return (
    <section className="section" aria-labelledby="breakouts-title">
      <h2 id="breakouts-title">What broke out</h2>
      <p className="section-note">At least 2.5× the usual views for that platform.</p>
      {breakouts.length === 0 ? (
        <p className="empty-note">
          Nothing broke out in the last {days} days. Try a longer window to look further back.
        </p>
      ) : (
        <ol className="breakouts">
          {breakouts.map((b) => (
            <li key={`${b.platform}-${b.publishedDate}-${b.title}`} className="breakout">
              <span className="breakout-multiple">{formatMultiple(b.multiple)}</span>
              <div className="breakout-body">
                <p className="breakout-title">{b.title}</p>
                <p className="breakout-meta">
                  <span className="dot" style={{ background: `var(--platform-${b.platform})` }} aria-hidden="true" />
                  {platformName(b.platform)} {b.contentType} · {formatLongDate(b.publishedDate)}
                </p>
                <p className="breakout-views">
                  {formatNumber(b.views)} {viewsWord(b.contentType)}, usually {formatNumber(b.typicalViews)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
