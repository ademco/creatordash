import { formatNumber, formatShare, formatSigned } from '../lib/format';
import { audienceWord, platformName } from '../lib/platforms';

interface Share {
  platform: string;
  audience: number;
  share: number;
  gained: number;
}

/** "Where your fans are": one thin bar per platform, biggest first, with the numbers beside it. */
export function PlatformShares({ shares, days }: { shares: Share[]; days: number }) {
  return (
    <section className="section" aria-labelledby="shares-title">
      <h2 id="shares-title">Where your fans are</h2>
      <ul className="shares">
        {shares.map(({ platform, audience, share, gained }) => (
          <li key={platform} className="share">
            <div className="share-label">
              <span className="share-name">{platformName(platform)}</span>
              <span className="share-value">
                {formatNumber(audience)} {audienceWord(platform)} · {formatShare(share)}
              </span>
            </div>
            {/* The bar is decoration; the text above carries the value. */}
            <div className="share-track" aria-hidden="true">
              <div
                className="share-bar"
                style={{ width: `${Math.max(share * 100, 1)}%`, background: `var(--platform-${platform})` }}
              />
            </div>
            <p className="share-gain">
              {formatSigned(gained)} in the last {days} days
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
