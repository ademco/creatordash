import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BigQueryDataSource, bigQueryRunner } from './bigquery-datasource.js';
import { CachedDataSource } from './cached-datasource.js';
import type { DataSource } from './datasource.js';
import { LocalDataSource } from './local-datasource.js';

// api/src and api/dist are both two levels below the repo root.
export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Picks the data source from environment variables:
 *   DATA_SOURCE=local (default)  CSV files in DATA_DIR (default data/sample)
 *   DATA_SOURCE=bigquery         BQ_PROJECT, BQ_DATASET (default fan_insights),
 *                                BQ_LOCATION (e.g. US), SAMPLE_DATA=true|false,
 *                                CACHE_SECONDS (default 300)
 *
 * A relative DATA_DIR is resolved from the repo root, not the current folder,
 * because npm runs workspace scripts from inside api/.
 */
export function createDataSource(env: NodeJS.ProcessEnv): DataSource {
  const kind = env.DATA_SOURCE ?? 'local';
  if (kind === 'local') {
    const dir = env.DATA_DIR ?? 'data/sample';
    return new LocalDataSource(isAbsolute(dir) ? dir : resolve(REPO_ROOT, dir), REPO_ROOT);
  }
  if (kind === 'bigquery') {
    const project = env.BQ_PROJECT ?? env.GOOGLE_CLOUD_PROJECT;
    if (!project) throw new Error('DATA_SOURCE=bigquery needs BQ_PROJECT (the Google Cloud project ID)');
    const bigquery = new BigQueryDataSource(
      { project, dataset: env.BQ_DATASET ?? 'fan_insights', sample: env.SAMPLE_DATA === 'true' },
      bigQueryRunner(project, env.BQ_LOCATION),
    );
    return new CachedDataSource(bigquery, Number(env.CACHE_SECONDS ?? 300) * 1000);
  }
  throw new Error(`Unknown DATA_SOURCE "${kind}". Use "local" or "bigquery".`);
}
