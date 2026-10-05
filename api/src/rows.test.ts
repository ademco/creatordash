import { describe, expect, it } from 'vitest';

import { DataError, isIsoDate, parseAudienceCsv, parseContentCsv } from './rows.js';

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
