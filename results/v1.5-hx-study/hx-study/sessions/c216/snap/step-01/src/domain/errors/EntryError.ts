/** An entry the congress turns down. `statusCode` optionally tells the entry form which HTTP status fits the refusal. */
export class EntryError extends Error {
  constructor(message: string, readonly statusCode?: number) {
    super(message);
    this.name = 'EntryError';
  }
}
