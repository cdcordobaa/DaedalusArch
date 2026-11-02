/** An entry the congress turns down. An optional statusCode lets the entry form answer with a more specific HTTP status. */
export class EntryError extends Error {
  constructor(message: string, readonly statusCode?: number) {
    super(message);
    this.name = 'EntryError';
  }
}
