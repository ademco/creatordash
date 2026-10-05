import { BigQuery } from '@google-cloud/bigquery';

import type { DataSource } from './datasource.js';
import type { AudienceRow, ContentRow, ContentType, DataInfo, Platform } from './types.js';

/** Runs one SQL query with named parameters and returns plain row objects. */
export type RunQuery = (
  sql: string,
  params?: Record<string, string>,
  types?: Record<string, string>,
) => Promise<Record<string, unknown>[]>;

export interface BigQuerySettings {
  /** Google Cloud project that holds the dataset. */
  project: string;
  /** Dataset name, e.g. "fan_insights". */
  dataset: string;
  /** Whether the loaded rows are the made-up sample data (shown in the UI). */
  sample: boolean;
}

// Table names cannot be query parameters, so they are pasted into the SQL.
// Allowing only these characters makes that safe from SQL injection.
const IDENTIFIER = /^[A-Za-z0-9_-]+$/;

/**
 * Reads the `audience` and `content` tables from BigQuery.
 *
 * Every query filters on the date column with a parameter (@since), never by
 * gluing user input into SQL. FORMAT_DATE returns dates as YYYY-MM-DD strings,
 * the same shape the CSV source produces, so the insight code cannot tell the
 * two sources apart.
 */
export class BigQueryDataSource implements DataSource {
  private readonly audienceTable: string;
  private readonly contentTable: string;

  constructor(
    private readonly settings: BigQuerySettings,
    private readonly runQuery: RunQuery,
  ) {
    if (!IDENTIFIER.test(settings.project) || !IDENTIFIER.test(settings.dataset)) {
      throw new Error(`Invalid BigQuery project or dataset name: "${settings.project}.${settings.dataset}"`);
    }
    this.audienceTable = `\`${settings.project}.${settings.dataset}.audience\``;
    this.contentTable = `\`${settings.project}.${settings.dataset}.content\``;
  }

  async newestDate(): Promise<string | null> {
    const rows = await this.runQuery(`
      SELECT FORMAT_DATE('%F', MAX(d)) AS newest
      FROM (
        SELECT MAX(date) AS d FROM ${this.audienceTable}
        UNION ALL
        SELECT MAX(published_date) FROM ${this.contentTable}
      )`);
    return (rows[0]?.newest as string | null | undefined) ?? null;
  }

  async audienceSince(since: string): Promise<AudienceRow[]> {
    const rows = await this.runQuery(
      `
      SELECT FORMAT_DATE('%F', date) AS date, platform, audience
      FROM ${this.audienceTable}
      WHERE date >= @since
      ORDER BY date, platform`,
      { since },
      { since: 'DATE' },
    );
    return rows.map((row) => ({
      date: String(row.date),
      platform: String(row.platform) as Platform,
      audience: Number(row.audience),
    }));
  }

  async contentSince(since: string): Promise<ContentRow[]> {
    const rows = await this.runQuery(
      `
      SELECT FORMAT_DATE('%F', published_date) AS published_date, platform, content_type, title, views
      FROM ${this.contentTable}
      WHERE published_date >= @since
      ORDER BY published_date, platform`,
      { since },
      { since: 'DATE' },
    );
    return rows.map((row) => ({
      publishedDate: String(row.published_date),
      platform: String(row.platform) as Platform,
      contentType: String(row.content_type) as ContentType,
      title: String(row.title),
      views: Number(row.views),
    }));
  }

  async info(): Promise<DataInfo> {
    return {
      source: `BigQuery dataset ${this.settings.project}.${this.settings.dataset}`,
      sample: this.settings.sample,
      newestDate: await this.newestDate(),
    };
  }
}

/** The real query runner, using Application Default Credentials (the Cloud Run service account). */
export function bigQueryRunner(project: string, location: string | undefined): RunQuery {
  const client = new BigQuery({ projectId: project });
  return async (sql, params, types) => {
    const [rows] = await client.query({ query: sql, params, types, location });
    return rows as Record<string, unknown>[];
  };
}
