/** An entry the congress turns down. */
export class EntryError extends Error {
  constructor(message: string, readonly statusCode?: number, readonly headers?: Record<string, string>) {
    super(message);
    this.name = 'EntryError';
  }
}
