// A small CSV parser that follows RFC 4180, the closest thing CSV has to a spec.
// Writing one by hand is about 40 lines; the tricky parts are quoted fields:
//   "Cold Coffee, Warm Hands"      a comma inside quotes is part of the field
//   "Fan duet: ""Glass Houses"""   two quotes inside quotes mean one literal quote
//   "line one\nline two"           a newline inside quotes does not end the row

export interface CsvRow {
  /** 1-based line in the file where this row starts, for error messages. */
  line: number;
  fields: string[];
}

export function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  // Excel and Google Sheets often start UTF-8 files with an invisible byte-order mark.
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  const endRow = () => {
    fields.push(field);
    // Skip blank lines rather than treating them as a row with one empty field.
    if (!(fields.length === 1 && fields[0] === '')) rows.push({ line: rowStartLine, fields });
    fields = [];
    field = '';
  };

  for (; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++; // Windows line ending
      endRow();
      line++;
      rowStartLine = line;
    } else {
      field += ch;
    }
  }

  if (inQuotes) throw new Error(`Line ${rowStartLine}: a quoted field is never closed`);
  if (field !== '' || fields.length > 0) endRow();
  return rows;
}

export interface CsvRecord {
  line: number;
  values: Record<string, string>;
}

/**
 * Parses CSV with a header row into one object per row, keyed by column name.
 * Column names are trimmed and lowercased so "Date " matches "date".
 */
export function parseCsvRecords(text: string, requiredColumns: readonly string[]): CsvRecord[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error('The file is empty');

  const columns = header.fields.map((name) => name.trim().toLowerCase());
  const missing = requiredColumns.filter((name) => !columns.includes(name));
  if (missing.length > 0) {
    throw new Error(`Missing column(s): ${missing.join(', ')}. Found: ${columns.join(', ')}`);
  }

  return rows.map((row) => {
    if (row.fields.length !== columns.length) {
      throw new Error(
        `Line ${row.line}: expected ${columns.length} fields but found ${row.fields.length}. ` +
          'If a title contains a comma, wrap it in double quotes.',
      );
    }
    const values: Record<string, string> = {};
    columns.forEach((name, index) => {
      values[name] = row.fields[index] ?? '';
    });
    return { line: row.line, values };
  });
}
