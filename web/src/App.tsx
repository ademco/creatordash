import { useQuery } from '@apollo/client/react';
import { useEffect, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';

import { BreakoutList } from './components/BreakoutList';
import { GrowthChart } from './components/GrowthChart';
import { Headline } from './components/Headline';
import { PlatformShares } from './components/PlatformShares';
import { EmptyState, ErrorState, LoadingState } from './components/States';
import { TopBar, WINDOW_OPTIONS } from './components/TopBar';
import { DASHBOARD_QUERY, type DashboardData } from './graphql/dashboard';
import { formatLongDate } from './lib/format';
import { usePrefersReducedMotion } from './lib/useThemeColors';

// The chosen window lives in the URL (?days=90), so a refresh or a shared link
// shows the same view.
function initialDays(): number {
  const fromUrl = Number(new URLSearchParams(window.location.search).get('days'));
  return (WINDOW_OPTIONS as readonly number[]).includes(fromUrl) ? fromUrl : 90;
}

/** Each band rises in a beat after the one above it (see .band in styles.css). */
const stagger = (index: number) => ({ '--i': index }) as CSSProperties;

export function App() {
  const [days, setDays] = useState(initialDays);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('days', String(days));
    window.history.replaceState(null, '', url);
  }, [days]);

  const { data, loading, error, refetch } = useQuery(DASHBOARD_QUERY, { variables: { days } });

  // What is on screen lags `data` by one step on purpose. When a new window's
  // numbers arrive, the swap happens inside a view transition, so the browser
  // cross-fades the old numbers into the new ones instead of cutting. Browsers
  // without view transitions (and visitors who prefer reduced motion) just get
  // the cut. The first load is never animated this way: there is nothing to fade from.
  const [rendered, setRendered] = useState<DashboardData | undefined>(undefined);
  useEffect(() => {
    if (!data || data === rendered) return;
    const canFade = rendered !== undefined && !reducedMotion && typeof document.startViewTransition === 'function';
    if (canFade) {
      document.startViewTransition(() => {
        flushSync(() => setRendered(data));
      });
    } else {
      setRendered(data);
    }
  }, [data, rendered, reducedMotion]);

  const shown = rendered ?? data;
  // While a slow window loads, the old numbers dim (after a short delay, in CSS)
  // instead of flashing a spinner and making the layout jump.
  const refreshing = loading && !data && Boolean(shown);

  // Highlights and text selection use the color of the platform that grew most.
  const topPlatform = shown?.overview.topPlatform ?? null;
  useEffect(() => {
    document.documentElement.style.setProperty('--top-platform', topPlatform ? `var(--platform-${topPlatform})` : 'var(--focus)');
  }, [topPlatform]);

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
        <Headline overview={overview} platformCount={platformBreakdown.length} sample={shown.dataInfo.sample} />
        <div className="band" style={stagger(1)}>
          <div className="page band-inner">
            <GrowthChart series={audienceGrowth} days={overview.days} />
          </div>
        </div>
        <div className="band band-raised" style={stagger(2)}>
          <div className="page band-inner columns">
            <PlatformShares shares={platformBreakdown} days={overview.days} />
            <BreakoutList breakouts={breakouts} days={overview.days} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <TopBar days={days} onDaysChange={setDays} />
      <main id="main">{body}</main>
      <footer className="band-footer">
        <div className="page footer">
          <p>
            {shown?.dataInfo.newestDate && (
              <>
                Numbers up to {formatLongDate(shown.dataInfo.newestDate)}, from {shown.dataInfo.source}.{' '}
              </>
            )}
            Built by Adem. <a href="https://github.com/ademco/creatordash">Source on GitHub</a>.
          </p>
        </div>
      </footer>
    </>
  );
}
