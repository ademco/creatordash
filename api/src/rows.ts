// Turns CSV text into typed rows, and explains exactly what is wrong when a file
// does not fit the data model. Real exports are messy, so the messages name the
// file, the line, and the fix.

import { parseCsvRecords } from './csv.js';
import {
  CONTENT_TYPES,
  PLATFORMS,
  type AudienceRow,
  type ContentRow,
  type ContentType,
  type Platform,
} from './types.js';

export const AUDIENCE_COLUMNS = ['date', 'platform', 'audience'] as const;
export const CONTENT_COLUMNS = ['published_date', 'platform', 'content_type', 'title', 'views'] as const;

// Report up to this many problems at once, so one run shows most of what to fix.
const MAX_ERRORS = 10;

export class DataError extends Error {
  constructor(file: string, problems: string[]) {
    const shown = problems.slice(0, MAX_ERRORS);
    const more = problems.length > shown.length ? `\n  ...and ${problems.length - shown.length} more` : '';
    super(`${file} has problems:\n  ${shown.join('\n  ')}${more}`);
    this.name = 'DataError';
  }
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // Rejects dates like 2026-02-30, which match the pattern but do not exist.
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function parseCount(value: string): number | null {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

function parseChoice<T extends string>(value: string, choices: readonly T[]): T | null {
  const normalized = value.trim().toLowerCase();
  return (choices as readonly string[]).includes(normalized) ? (normalized as T) : null;
}

export function parseAudienceCsv(text: string, file = 'audience.csv'): AudienceRow[] {
  const problems: string[] = [];
  const rows: AudienceRow[] = [];
  let records;
  try {
    records = parseCsvRecords(text, AUDIENCE_COLUMNS);
  } catch (error) {
    throw new DataError(file, [(error as Error).message]);
  }

  for (const { line, values } of records) {
    const date = (values.date ?? '').trim();
    const platform = parseChoice<Platform>(values.platform ?? '', PLATFORMS);
    const audience = parseCount(values.audience ?? '');

    if (!isIsoDate(date)) problems.push(`line ${line}: date "${values.date}" should look like 2026-09-30`);
    if (!platform) problems.push(`line ${line}: platform "${values.platform}" should be one of ${PLATFORMS.join(', ')}`);
    if (audience === null) problems.push(`line ${line}: audience "${values.audience}" should be a whole number like 12345`);
    if (isIsoDate(date) && platform && audience !== null) rows.push({ date, platform, audience });
  }

  if (problems.length > 0) throw new DataError(file, problems);
  return rows;
}

export function parseContentCsv(text: string, file = 'content.csv'): ContentRow[] {
  const problems: string[] = [];
  const rows: ContentRow[] = [];
  let records;
  try {
    records = parseCsvRecords(text, CONTENT_COLUMNS);
  } catch (error) {
    throw new DataError(file, [(error as Error).message]);
  }

  for (const { line, values } of records) {
    const publishedDate = (values.published_date ?? '').trim();
    const platform = parseChoice<Platform>(values.platform ?? '', PLATFORMS);
    const contentType = parseChoice<ContentType>(values.content_type ?? '', CONTENT_TYPES);
    const title = (values.title ?? '').trim();
    const views = parseCount(values.views ?? '');

    if (!isIsoDate(publishedDate)) {
      problems.push(`line ${line}: published_date "${values.published_date}" should look like 2026-09-30`);
    }
    if (!platform) problems.push(`line ${line}: platform "${values.platform}" should be one of ${PLATFORMS.join(', ')}`);
    if (!contentType) {
      problems.push(`line ${line}: content_type "${values.content_type}" should be one of ${CONTENT_TYPES.join(', ')}`);
    }
    if (!title) problems.push(`line ${line}: title is empty`);
    if (views === null) problems.push(`line ${line}: views "${values.views}" should be a whole number like 12345`);
    if (isIsoDate(publishedDate) && platform && contentType && title && views !== null) {
      rows.push({ publishedDate, platform, contentType, title, views });
    }
  }

  if (problems.length > 0) throw new DataError(file, problems);
  return rows;
}

// Wraps a field in quotes when CSV needs it (commas, quotes, line breaks) and
// doubles any quotes inside, the same rules spreadsheet apps follow.
function csvField(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(columns: readonly string[], rows: (string | number)[][]): string {
  return [columns.join(','), ...rows.map((row) => row.map(csvField).join(','))].join('\n') + '\n';
}

/** Writes checked rows back out in the exact column order of the BigQuery table. */
export function audienceToCsv(rows: AudienceRow[]): string {
  return toCsv(
    AUDIENCE_COLUMNS,
    rows.map((row) => [row.date, row.platform, row.audience]),
  );
}

/** Writes checked rows back out in the exact column order of the BigQuery table. */
export function contentToCsv(rows: ContentRow[]): string {
  return toCsv(
    CONTENT_COLUMNS,
    rows.map((row) => [row.publishedDate, row.platform, row.contentType, row.title, row.views]),
  );
}
