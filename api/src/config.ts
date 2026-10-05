import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DataSource } from './datasource.js';
import { LocalDataSource } from './local-datasource.js';

// api/src and api/dist are both two levels below the repo root.
export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Picks the data source from environment variables:
 *   DATA_SOURCE=local (default)  CSV files in DATA_DIR (default data/sample)
 *   DATA_SOURCE=bigquery         BigQuery tables (added in Phase 6)
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
  throw new Error(`Unknown DATA_SOURCE "${kind}". Use "local".`);
}
