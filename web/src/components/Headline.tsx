import { useCountUp } from '../lib/countUp';
import { formatLongDate, formatNumber } from '../lib/format';
import { audienceLine, headlineParts, type OverviewNumbers } from '../lib/summary';

interface Props {
  overview: OverviewNumbers & { startDate: string | null; endDate: string | null };
  platformCount: number;
  /** True for the made-up sample data, which the page must say plainly. */
  sample: boolean;
}

/**
 * The one sentence an artist should read first, in a big dark band. Above it,
 * one small line says which dates it covers (and whether the numbers are made
 * up); below it, one line gives the combined audience. The number in the
 * sentence rolls up to its value.
 */
export function Headline({ overview, platformCount, sample }: Props) {
  const { before, count, after } = headlineParts(overview);
  const rolling = useCountUp(count ?? 0);
  const dates =
    overview.startDate && overview.endDate
      ? `${formatLongDate(overview.startDate)} to ${formatLongDate(overview.endDate)}`
      : null;

  return (
    <section className="band band-hero" aria-labelledby="headline-text">
      <div className="page band-inner">
        {(dates || sample) && (
          <p className="headline-dates">
            {dates}
            {sample && (
              <span className="sticker" role="note">
                Sample data: every number here is made up
              </span>
            )}
          </p>
        )}
        <h1 id="headline-text">
          {before}
          {count !== null && (
            // Screen readers get the final number at once. Sighted readers see it
            // roll up; the invisible spacer holds the final width so the words
            // around it do not shuffle while the digits change.
            <span className="count">
              <span className="visually-hidden">{formatNumber(count)}</span>
              <span className="count-spacer" aria-hidden="true">
                {formatNumber(count)}
              </span>
              <span className="count-live" aria-hidden="true">
                {formatNumber(rolling)}
              </span>
            </span>
          )}
          {after}
        </h1>
        <p className="headline-sub">{audienceLine(overview, platformCount)}</p>
      </div>
    </section>
  );
}
