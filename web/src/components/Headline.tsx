import { formatLongDate } from '../lib/format';
import { audienceLine, headline, type OverviewNumbers } from '../lib/summary';

interface Props {
  overview: OverviewNumbers & { startDate: string | null; endDate: string | null };
  platformCount: number;
}

/** The one sentence an artist should read first, then the combined audience. */
export function Headline({ overview, platformCount }: Props) {
  return (
    <section className="headline" aria-labelledby="headline-text">
      <h1 id="headline-text">{headline(overview)}</h1>
      <p className="headline-sub">{audienceLine(overview, platformCount)}</p>
      {overview.startDate && overview.endDate && (
        <p className="headline-dates">
          {formatLongDate(overview.startDate)} to {formatLongDate(overview.endDate)}
        </p>
      )}
    </section>
  );
}
