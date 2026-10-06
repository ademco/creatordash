import { formatLongDate } from '../lib/format';
import { audienceLine, headline, type OverviewNumbers } from '../lib/summary';

interface Props {
  overview: OverviewNumbers & { startDate: string | null; endDate: string | null };
  platformCount: number;
  /** True for the made-up sample data, which the page must say plainly. */
  sample: boolean;
}

/**
 * The one sentence an artist should read first. Above it, one small line says
 * which dates it covers (and whether the numbers are made up); below it, one
 * line gives the combined audience.
 */
export function Headline({ overview, platformCount, sample }: Props) {
  const dates =
    overview.startDate && overview.endDate
      ? `${formatLongDate(overview.startDate)} to ${formatLongDate(overview.endDate)}`
      : null;
  return (
    <section className="headline" aria-labelledby="headline-text">
      {(dates || sample) && (
        <p className="headline-dates">
          {dates}
          {dates && sample && ' · '}
          {sample && <span role="note">Sample data: every number here is made up</span>}
        </p>
      )}
      <h1 id="headline-text">{headline(overview)}</h1>
      <p className="headline-sub">{audienceLine(overview, platformCount)}</p>
    </section>
  );
}
