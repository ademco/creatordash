import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './config.js';
import { LocalDataSource } from './local-datasource.js';

describe('LocalDataSource', () => {
  it('loads the real-data templates, so the documented format stays valid', async () => {
    const source = new LocalDataSource(join(REPO_ROOT, 'data/templates'), REPO_ROOT);
    expect(await source.newestDate()).toBe('2026-10-01');
    expect(await source.audienceSince('2026-10-01')).toHaveLength(5);
    expect((await source.contentSince('2026-09-28')).map((c) => c.title)).toContain(
      'Studio vlog: mixing, mastering, and coffee',
    );
    expect(await source.info()).toMatchObject({ source: 'CSV files in data/templates', sample: false });
  });

  it('picks up edits to the CSV files without a restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fan-insights-'));
    const content = 'published_date,platform,content_type,title,views\n';
    writeFileSync(join(dir, 'content.csv'), content);
    writeFileSync(join(dir, 'audience.csv'), 'date,platform,audience\n2026-10-01,kick,10\n');
    const source = new LocalDataSource(dir, REPO_ROOT);
    expect(await source.newestDate()).toBe('2026-10-01');

    // Modification times can be equal within one millisecond; bump explicitly.
    await new Promise((resolve) => setTimeout(resolve, 20));
    writeFileSync(join(dir, 'audience.csv'), 'date,platform,audience\n2026-10-02,kick,12\n');
    expect(await source.newestDate()).toBe('2026-10-02');
  });
});

describe('LocalDataSource with a missing folder', () => {
  it('says how to fix it', async () => {
    const source = new LocalDataSource(join(REPO_ROOT, 'data/nowhere'), REPO_ROOT);
    await expect(source.newestDate()).rejects.toThrow(/Can't find .*audience\.csv\. Copy the templates there/);
  });
});
