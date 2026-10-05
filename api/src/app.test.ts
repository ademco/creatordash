// End-to-end: start the real Express app on the sample data and query it over
// HTTP, the same way the dashboard does. The expected numbers are the ones
// documented in data/sample/README.md.

import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import { createDataSource } from './config.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = await createApp(createDataSource({ DATA_SOURCE: 'local', DATA_DIR: 'data/sample' }));
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

async function graphql(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(`${baseUrl}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json()) as { data?: Record<string, any>; errors?: unknown[] };
  expect(body.errors).toBeUndefined();
  return body.data!;
}

describe('the API on sample data', () => {
  it('answers the health check', async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('says the data is sample data', async () => {
    const { dataInfo } = await graphql('{ dataInfo { source sample newestDate } }');
    expect(dataInfo).toEqual({ source: 'CSV files in data/sample', sample: true, newestDate: '2026-09-30' });
  });

  it('computes the overview for 30, 90, and 180 days', async () => {
    const query = `query ($days: Int) { overview(days: $days) { days startDate endDate gained topPlatform topPlatformGained } }`;
    expect((await graphql(query, { days: 30 })).overview).toEqual({
      days: 30,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      gained: 3414,
      topPlatform: 'tiktok',
      topPlatformGained: 2211,
    });
    expect((await graphql(query, { days: 90 })).overview).toMatchObject({ gained: 11041, topPlatform: 'spotify' });
    expect((await graphql(query, { days: 180 })).overview).toMatchObject({ gained: 17645, topPlatform: 'tiktok' });
  });

  it('finds the planned breakouts in each window', async () => {
    const query = `query ($days: Int) { breakouts(days: $days) { title platform multiple } }`;
    const titles = async (days: number) =>
      ((await graphql(query, { days })).breakouts as { title: string }[]).map((b) => b.title);

    expect(await titles(30)).toEqual(['Fan duet: "Glass Houses", acoustic', '24-hour charity stream, part 1']);
    expect(await titles(90)).toHaveLength(5);
    expect(await titles(180)).toHaveLength(6);
  });

  it('clamps days, so 1000 behaves like 365', async () => {
    const { overview } = await graphql('{ overview(days: 1000) { days startDate } }');
    expect(overview).toEqual({ days: 365, startDate: '2026-04-04' });
  });

  it('returns growth series with every platform, biggest first', async () => {
    const { audienceGrowth } = await graphql('{ audienceGrowth(days: 90) { platform points { date } } }');
    expect(audienceGrowth.map((s: { platform: string }) => s.platform)).toEqual([
      'tiktok',
      'spotify',
      'youtube',
      'twitch',
      'kick',
    ]);
    expect(audienceGrowth[0].points).toHaveLength(90);
  });
});

describe('serving the built dashboard', () => {
  it('serves index.html at / with no-cache, and hashed assets as immutable', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const webDir = mkdtempSync(join(tmpdir(), 'web-'));
    mkdirSync(join(webDir, 'assets'));
    writeFileSync(join(webDir, 'index.html'), '<h1>dashboard</h1>');
    writeFileSync(join(webDir, 'assets', 'app-abc123.js'), 'console.log(1)');

    const app = await createApp(createDataSource({ DATA_DIR: 'data/sample' }), { webDir });
    const webServer = app.listen(0);
    await new Promise((resolve) => webServer.once('listening', resolve));
    const url = `http://localhost:${(webServer.address() as AddressInfo).port}`;
    try {
      const page = await fetch(`${url}/`);
      expect(await page.text()).toBe('<h1>dashboard</h1>');
      expect(page.headers.get('cache-control')).toBe('no-cache');
      const asset = await fetch(`${url}/assets/app-abc123.js`);
      expect(asset.headers.get('cache-control')).toContain('immutable');
      expect((await fetch(`${url}/healthz`)).status).toBe(200);
    } finally {
      webServer.close();
    }
  });
});
