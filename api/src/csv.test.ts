import { describe, expect, it } from 'vitest';

import { parseCsv, parseCsvRecords } from './csv.js';

const fields = (text: string) => parseCsv(text).map((row) => row.fields);

describe('parseCsv', () => {
  it('splits plain rows and fields', () => {
    expect(fields('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    expect(fields('title,views\n"Cold Coffee, Warm Hands",100\n')).toEqual([
      ['title', 'views'],
      ['Cold Coffee, Warm Hands', '100'],
    ]);
  });

  it('turns doubled quotes inside a quoted field into one quote', () => {
    expect(fields('"Fan duet: ""Glass Houses"", acoustic",5')).toEqual([['Fan duet: "Glass Houses", acoustic', '5']]);
  });

  it('keeps newlines inside quoted fields and reports the line each row starts on', () => {
    const rows = parseCsv('a,b\n"line one\nline two",x\nlast,row\n');
    expect(rows).toEqual([
      { line: 1, fields: ['a', 'b'] },
      { line: 2, fields: ['line one\nline two', 'x'] },
      { line: 4, fields: ['last', 'row'] },
    ]);
  });

  it('handles Windows line endings, a missing final newline, and empty fields', () => {
    expect(fields('a,b\r\n1,\r\n,2')).toEqual([
      ['a', 'b'],
      ['1', ''],
      ['', '2'],
    ]);
  });

  it('ignores a UTF-8 byte-order mark and blank lines', () => {
    expect(fields('﻿a,b\n\n1,2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('accepts an empty quoted field', () => {
    expect(fields('"",x')).toEqual([['', 'x']]);
  });

  it('throws when a quoted field is never closed', () => {
    expect(() => parseCsv('a,b\n"oops,1\n')).toThrow('Line 2: a quoted field is never closed');
  });
});

describe('parseCsvRecords', () => {
  it('maps rows to objects using trimmed, lowercased header names', () => {
    expect(parseCsvRecords('Date , Platform\n2026-09-30,spotify\n', ['date', 'platform'])).toEqual([
      { line: 2, values: { date: '2026-09-30', platform: 'spotify' } },
    ]);
  });

  it('names missing columns', () => {
    expect(() => parseCsvRecords('date,platform\n', ['date', 'platform', 'audience'])).toThrow(
      'Missing column(s): audience',
    );
  });

  it('explains a row with the wrong number of fields', () => {
    expect(() => parseCsvRecords('title,views\nCold Coffee, Warm Hands,100\n', ['title', 'views'])).toThrow(
      /Line 2: expected 2 fields but found 3.*double quotes/,
    );
  });

  it('rejects an empty file', () => {
    expect(() => parseCsvRecords('', ['date'])).toThrow('The file is empty');
  });
});
