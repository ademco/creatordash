import { BigQuery } from '@google-cloud/bigquery';
import { describe, expect, it } from 'vitest';

import { BigQueryDataSource, type RunQuery } from './bigquery-datasource.js';

// A fake query runner records every call and returns canned rows, so the SQL
// and the row mapping are tested without a Google Cloud project.
function fakeRunner(rows: Record<string, unknown>[]) {
  const calls: { sql: string; params?: Record<string, string> }[] = [];
  const run: RunQuery = async (sql, params) => {
    calls.push({ sql, params });
    return rows;
  };
  return { run, calls };
}

const settings = { project: 'my-project', dataset: 'fan_insights', sample: false };

describe('BigQueryDataSource', () => {
  it('filters audience by a DATE parameter and maps rows', async () => {
    const { run, calls } = fakeRunner([{ date: '2026-09-30', platform: 'tiktok', audience: 21666 }]);
    const source = new BigQueryDataSource(settings, run);

    expect(await source.audienceSince('2026-09-01')).toEqual([
      { date: '2026-09-30', platform: 'tiktok', audience: 21666 },
    ]);
    expect(calls[0]!.sql).toContain('FROM `my-project.fan_insights.audience`');
    expect(calls[0]!.sql).toContain('WHERE date >= CAST(@since AS DATE)');
    expect(calls[0]!.params).toEqual({ since: '2026-09-01' });
  });

  it('maps snake_case content columns to camelCase fields', async () => {
    const { run, calls } = fakeRunner([
      { published_date: '2026-09-15', platform: 'tiktok', content_type: 'short', title: 'Fan duet', views: 48055 },
    ]);
    const source = new BigQueryDataSource(settings, run);
    expect(await source.contentSince('2026-07-03')).toEqual([
      { publishedDate: '2026-09-15', platform: 'tiktok', contentType: 'short', title: 'Fan duet', views: 48055 },
    ]);
    expect(calls[0]!.sql).toContain('WHERE published_date >= CAST(@since AS DATE)');
  });

  it('finds the newest date across both tables, or null when empty', async () => {
    expect(await new BigQueryDataSource(settings, fakeRunner([{ newest: '2026-09-30' }]).run).newestDate()).toBe(
      '2026-09-30',
    );
    expect(await new BigQueryDataSource(settings, fakeRunner([{ newest: null }]).run).newestDate()).toBeNull();
  });

  it('describes itself for the UI', async () => {
    const source = new BigQueryDataSource({ ...settings, sample: true }, fakeRunner([{ newest: '2026-09-30' }]).run);
    expect(await source.info()).toEqual({
      source: 'BigQuery dataset my-project.fan_insights',
      sample: true,
      newestDate: '2026-09-30',
    });
  });

  // The fake runner above skips the client library, which is how a dropped
  // parameter once reached production. This runs the library's own step that
  // turns a parameter into what BigQuery receives, and checks the date survives.
  it('sends the date parameter with its value through the real client library', () => {
    const sent = BigQuery.valueToQueryParameter_('2026-07-03');
    expect(sent).toEqual({ parameterType: { type: 'STRING' }, parameterValue: { value: '2026-07-03' } });
  });

  it('refuses table names that could inject SQL', () => {
    expect(() => new BigQueryDataSource({ ...settings, dataset: 'x`; DROP TABLE y; --' }, fakeRunner([]).run)).toThrow(
      'Invalid BigQuery project or dataset name',
    );
  });
});
