export interface FinanceExportResult {
  file: string;
  /** The number of class lines. */
  classes: number;
}

export interface FinanceExport {
  financeExport(date: unknown): FinanceExportResult;
}
