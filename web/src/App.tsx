import { useQuery } from '@apollo/client/react';
import { useEffect, useState } from 'react';

import { BreakoutList } from './components/BreakoutList';
import { GrowthChart } from './components/GrowthChart';
import { Headline } from './components/Headline';
import { PlatformShares } from './components/PlatformShares';
import { EmptyState, ErrorState, LoadingState } from './components/States';
import { TopBar, WINDOW_OPTIONS } from './components/TopBar';
import { DASHBOARD_QUERY } from './graphql/dashboard';
import { formatLongDate } from './lib/format';

// The chosen window lives in the URL (?days=90), so a refresh or a shared link
// shows the same view.
function initialDays(): number {
  const fromUrl = Number(new URLSearchParams(window.location.search).get('days'));
  return (WINDOW_OPTIONS as readonly number[]).includes(fromUrl) ? fromUrl : 90;
}

export function App() {
  const [days, setDays] = useState(initialDays);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('days', String(days));
    window.history.replaceState(null, '', url);
  }, [days]);

  const { data, previousData, loading, error, refetch } = useQuery(DASHBOARD_QUERY, { variables: { days } });
  // While a new window loads, keep showing the previous one (dimmed) instead of
  // flashing a spinner and making the layout jump.
  const shown = data ?? previousData;
  const refreshing = loading && !data && Boolean(previousData);

  let body;
  if (error && !shown) {
    body = <ErrorState message={error.message} onRetry={() => void refetch()} />;
  } else if (!shown) {
    body = <LoadingState />;
  } else if (shown.audienceGrowth.length === 0) {
    body = <EmptyState source={shown.dataInfo.source} />;
  } else {
    const { overview, audienceGrowth, platformBreakdown, breakouts } = shown;
    body = (
      <div className={refreshing ? 'content is-refreshing' : 'content'} aria-busy={refreshing}>
        <Headline overview={overview} platformCount={platformBreakdown.length} />
        <GrowthChart series={audienceGrowth} days={overview.days} />
        <div className="columns">
          <PlatformShares shares={platformBreakdown} days={overview.days} />
          <BreakoutList breakouts={breakouts} days={overview.days} />
        </div>
      </div>
    );
  }

  return (
    <>
      <TopBar days={days} onDaysChange={setDays} />
      {shown?.dataInfo.sample && (
        <p className="sample-note" role="note">
          Sample data: every number here is made up, so you can try the dashboard before connecting real stats.
        </p>
      )}
      <main id="main" className="page">
        {body}
      </main>
      <footer className="page footer">
        {shown?.dataInfo.newestDate ? (
          <p>
            Numbers up to {formatLongDate(shown.dataInfo.newestDate)}, from {shown.dataInfo.source}.
          </p>
        ) : null}
      </footer>
    </>
  );
}
