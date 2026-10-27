/** Where files for the finance office are left. */
export interface FinanceDrop {
  /** Writes a file, replacing one of the same name. */
  put(name: string, text: string): void;
}
