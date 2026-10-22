/** Runs the work in one database transaction (commit on success, rollback on error). */
export interface TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T>;
}
