export class StockError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
  }
}
