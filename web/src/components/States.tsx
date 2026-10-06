// Loading, empty, and error states. Each one says what is happening and what
// to do next, in plain words.

/**
 * While the first answer loads: gray shapes where the headline and chart will
 * be, so the page does not jump when the numbers arrive. They pulse gently
 * (no moving gradient), and stop pulsing when the visitor prefers less motion.
 */
export function LoadingState() {
  return (
    <div role="status">
      <section className="band band-hero">
        <div className="page band-inner">
          <h1 className="visually-hidden">Loading your numbers</h1>
          <p className="headline-dates">Loading your numbers… this usually takes a second.</p>
          <div className="skeleton-stack" aria-hidden="true">
            <span className="skeleton skeleton-title" style={{ width: '94%' }} />
            <span className="skeleton skeleton-title" style={{ width: '78%' }} />
            <span className="skeleton skeleton-title" style={{ width: '52%' }} />
            <span className="skeleton skeleton-line" style={{ width: '44%' }} />
          </div>
        </div>
      </section>
      <div className="band">
        <div className="page band-inner">
          <span className="skeleton skeleton-chart" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ source }: { source: string }) {
  return (
    <div className="page">
      <section className="state">
        <h1 className="state-title">No numbers yet</h1>
        <p>
          The dashboard is reading {source}, but there are no audience rows in it. Add <code>audience.csv</code> and{' '}
          <code>content.csv</code> (see <code>docs/REAL_DATA.md</code>), or run <code>npm run sample-data</code> to try
          it with made-up numbers.
        </p>
      </section>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="page">
      <section className="state" role="alert">
        <h1 className="state-title">Couldn’t load your numbers</h1>
        <p>
          The dashboard couldn’t reach the API. If you are running it locally, start everything with{' '}
          <code>npm run dev</code>, then try again.
        </p>
        <p className="state-detail">Details: {message}</p>
        <button type="button" className="button" onClick={onRetry}>
          Try again
        </button>
      </section>
    </div>
  );
}
