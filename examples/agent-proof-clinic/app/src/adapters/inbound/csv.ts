import type { HttpResponse } from "./http.js";

export type CsvValue = string | number;

/** A CSV document with CRLF line endings and a trailing newline. */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(csv: string): HttpResponse {
  return { status: 200, headers: { "content-type": "text/csv; charset=utf-8" }, body: csv };
}

/** Quotes when needed and neutralises spreadsheet formula prefixes. */
function csvCell(value: CsvValue): string {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
