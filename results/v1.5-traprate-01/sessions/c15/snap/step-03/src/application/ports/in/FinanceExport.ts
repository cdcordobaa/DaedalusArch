export interface FinanceExportResult {
  file: string;
  classes: number;
}

export interface FinanceExport {
  /** Writes the day's takings per class to the finance folder, replacing any earlier file for that day. */
  export(date: unknown): FinanceExportResult;
}
