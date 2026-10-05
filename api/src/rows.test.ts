import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  audienceToCsv,
  contentToCsv,
  DataError,
  isIsoDate,
  parseAudienceCsv,
  parseContentCsv,
} from './rows.js';

describe('isIsoDate', () => {
  it('accepts real YYYY-MM-DD dates only', () => {
    expect(isIsoDate('2026-09-30')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('09/30/2026')).toBe(false);
    expect(isIsoDate('2026-9-30')).toBe(false);
  });
});

describe('parseAudienceCsv', () => {
  it('parses rows and normalizes platform names', () => {
    expect(parseAudienceCsv('date,platform,audience\n2026-09-30, Spotify ,12345\n')).toEqual([
      { date: '2026-09-30', platform: 'spotify', audience: 12345 },
    ]);
  });

  it('reports every bad row with its line number', () => {
    const csv = 'date,platform,audience\n2026-09-31,spotify,10\n2026-09-30,myspace,10\n2026-09-30,kick,1.5k\n';
    expect(() => parseAudienceCsv(csv)).toThrow(DataError);
    try {
      parseAudienceCsv(csv);
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('line 2: date "2026-09-31"');
      expect(message).toContain('line 3: platform "myspace"');
      expect(message).toContain('line 4: audience "1.5k"');
    }
  });
});

describe('parseContentCsv', () => {
  it('parses quoted titles and maps snake_case columns to camelCase fields', () => {
    const csv = 'published_date,platform,content_type,title,views\n2026-09-15,tiktok,short,"Fan duet: ""Glass Houses"", acoustic",48055\n';
    expect(parseContentCsv(csv)).toEqual([
      {
        publishedDate: '2026-09-15',
        platform: 'tiktok',
        contentType: 'short',
        title: 'Fan duet: "Glass Houses", acoustic',
        views: 48055,
      },
    ]);
  });

  it('rejects unknown content types and empty titles', () => {
    const csv = 'published_date,platform,content_type,title,views\n2026-09-15,youtube,podcast,,10\n';
    expect(() => parseContentCsv(csv, 'my.csv')).toThrow(/my\.csv has problems:[\s\S]*content_type "podcast"[\s\S]*title is empty/);
  });

  it('wraps structural CSV errors in a DataError that names the file', () => {
    expect(() => parseContentCsv('date,views\n', 'content.csv')).toThrow(/content\.csv has problems:[\s\S]*Missing column/);
  });
});

describe('audienceToCsv and contentToCsv', () => {
  it('cleans a messy export into table column order', () => {
    const messy = 'Platform, Audience ,Date\r\n Spotify ,18500,2026-10-01\r\nTikTok,21700, 2026-10-01\r\n';
    expect(audienceToCsv(parseAudienceCsv(messy))).toBe(
      'date,platform,audience\n2026-10-01,spotify,18500\n2026-10-01,tiktok,21700\n',
    );
  });

  it('quotes titles with commas and doubles quotes inside them', () => {
    const text =
      'published_date,platform,content_type,title,views\n' +
      '2026-09-28,YouTube,Video,"Mixing, mastering, and coffee",2900\n' +
      '2026-09-29,tiktok,short,"Fan duet: ""Glass Houses""",48055\n';
    expect(contentToCsv(parseContentCsv(text))).toBe(
      'published_date,platform,content_type,title,views\n' +
        '2026-09-28,youtube,video,"Mixing, mastering, and coffee",2900\n' +
        '2026-09-29,tiktok,short,"Fan duet: ""Glass Houses""",48055\n',
    );
  });

  it('round-trips the sample data without changing a row', () => {
    const audience = parseAudienceCsv(readFileSync(new URL('../../data/sample/audience.csv', import.meta.url), 'utf8'));
    const content = parseContentCsv(readFileSync(new URL('../../data/sample/content.csv', import.meta.url), 'utf8'));
    expect(parseAudienceCsv(audienceToCsv(audience))).toEqual(audience);
    expect(parseContentCsv(contentToCsv(content))).toEqual(content);
    expect(content).toHaveLength(212);
  });
});
