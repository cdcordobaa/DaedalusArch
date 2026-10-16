/** RFC 4180-style CSV reader with a configurable delimiter (quoted fields, doubled quotes, CRLF, newlines in quotes). */
export function parseDelimited(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] as string;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (!(row.length === 1 && row[0] === '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/** Rows as records keyed by the header row (missing cells are ''). */
export function parseRecords(text: string, delimiter = ','): Record<string, string>[] {
  const [header, ...body] = parseDelimited(text.replace(/^﻿/, ''), delimiter);
  if (header === undefined) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}
