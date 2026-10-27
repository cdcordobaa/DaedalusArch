export interface TakingsExportResult {
  file: string;
  classes: number;
}

export interface TakingsExport {
  /** Writes a day's takings per class for the finance office. */
  exportDay(date: unknown): TakingsExportResult;
}
