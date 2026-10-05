// Loading, empty, and error states. Each one says what is happening and what
// to do next, in plain words.

export function LoadingState() {
  return (
    <section className="state" aria-live="polite">
      <h1 className="state-title">Loading your numbers…</h1>
      <p>This usually takes a second.</p>
    </section>
  );
}

export function EmptyState({ source }: { source: string }) {
  return (
    <section className="state">
      <h1 className="state-title">No numbers yet</h1>
      <p>
        The dashboard is reading {source}, but there are no audience rows in it. Add <code>audience.csv</code> and{' '}
        <code>content.csv</code> (see <code>docs/REAL_DATA.md</code>), or run <code>npm run sample-data</code> to try
        it with made-up numbers.
      </p>
    </section>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
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
  );
}
