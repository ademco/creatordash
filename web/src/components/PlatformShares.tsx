import { formatNumber, formatShare, formatSigned } from '../lib/format';
import { audienceWord, platformName } from '../lib/platforms';

interface Share {
  platform: string;
  audience: number;
  share: number;
  gained: number;
}

/** "Where your fans are": one bar per platform, biggest first, with the numbers above it. */
export function PlatformShares({ shares, days }: { shares: Share[]; days: number }) {
  // Bars are scaled to the biggest platform, so the longest bar fills the row
  // and differences are easy to see. The percentage text still gives the share.
  const biggest = Math.max(...shares.map((s) => s.share), 0);
  return (
    <section className="section" aria-labelledby="shares-title">
      <h2 id="shares-title">Where your fans are</h2>
      <p className="section-note">Audience today, and the change over {days} days.</p>
      <ul className="shares">
        {shares.map(({ platform, audience, share, gained }) => (
          <li key={platform} className="share">
            <div className="share-label">
              <span>
                <span className="share-name">{platformName(platform)}</span>{' '}
                <span className="share-gain">{formatSigned(gained)}</span>
              </span>
              <span className="share-value">
                {formatNumber(audience)} {audienceWord(platform)} · {formatShare(share)}
              </span>
            </div>
            {/* The bar is decoration; the text above carries the value. */}
            <div className="share-track" aria-hidden="true">
              <div
                className="share-bar"
                style={{
                  width: `${biggest > 0 ? Math.max((share / biggest) * 100, 1) : 1}%`,
                  background: `var(--platform-${platform})`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
