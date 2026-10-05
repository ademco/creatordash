import { readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { DataSource } from './datasource.js';
import { parseAudienceCsv, parseContentCsv } from './rows.js';
import type { AudienceRow, ContentRow, DataInfo } from './types.js';

interface Loaded {
  audience: AudienceRow[];
  content: ContentRow[];
  newestDate: string | null;
  mtimes: string;
}

/**
 * Reads `audience.csv` and `content.csv` from a folder.
 *
 * The files are re-read whenever they change on disk (checked by modification
 * time), so you can fix a CSV and refresh the dashboard without restarting.
 */
export class LocalDataSource implements DataSource {
  private loaded: Loaded | null = null;

  constructor(
    private readonly dir: string,
    private readonly repoRoot: string,
  ) {}

  private load(): Loaded {
    const audiencePath = join(this.dir, 'audience.csv');
    const contentPath = join(this.dir, 'content.csv');
    const mtimes = `${statSync(audiencePath).mtimeMs}:${statSync(contentPath).mtimeMs}`;
    if (this.loaded?.mtimes === mtimes) return this.loaded;

    const audience = parseAudienceCsv(readFileSync(audiencePath, 'utf8'), audiencePath);
    const content = parseContentCsv(readFileSync(contentPath, 'utf8'), contentPath);
    const dates = [...audience.map((row) => row.date), ...content.map((row) => row.publishedDate)];
    const newestDate = dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null;
    this.loaded = { audience, content, newestDate, mtimes };
    return this.loaded;
  }

  async newestDate(): Promise<string | null> {
    return this.load().newestDate;
  }

  async audienceSince(since: string): Promise<AudienceRow[]> {
    // YYYY-MM-DD strings sort the same way as the dates they stand for.
    return this.load().audience.filter((row) => row.date >= since);
  }

  async contentSince(since: string): Promise<ContentRow[]> {
    return this.load().content.filter((row) => row.publishedDate >= since);
  }

  async info(): Promise<DataInfo> {
    const folder = relative(this.repoRoot, this.dir) || '.';
    return {
      source: `CSV files in ${folder}`,
      sample: folder.split(/[\\/]/).includes('sample'),
      newestDate: this.load().newestDate,
    };
  }
}
