import type { AudienceRow, ContentRow, DataInfo } from './types.js';

/**
 * Where the rows come from. The resolvers only talk to this interface, so the
 * same API runs on local CSV files (LocalDataSource) or BigQuery
 * (BigQueryDataSource) without the insight logic knowing the difference.
 *
 * Data sources only filter by date. All the "what does this mean" logic lives
 * in insights.ts, where it is pure and tested once for both sources.
 */
export interface DataSource {
  /** Newest date in either table (YYYY-MM-DD), or null when there is no data. Windows count back from it. */
  newestDate(): Promise<string | null>;
  /** Audience rows dated on or after `since` (YYYY-MM-DD). */
  audienceSince(since: string): Promise<AudienceRow[]>;
  /** Content rows published on or after `since` (YYYY-MM-DD). */
  contentSince(since: string): Promise<ContentRow[]>;
  /** What the numbers are, for the "sample data" note in the UI. */
  info(): Promise<DataInfo>;
}
