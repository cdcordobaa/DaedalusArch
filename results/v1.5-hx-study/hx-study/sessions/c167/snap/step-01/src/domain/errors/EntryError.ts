/** An entry the congress turns down. */
export class EntryError extends Error {
  constructor(message: string, readonly statusCode?: number) {
    super(message);
    this.name = 'EntryError';
  }
}
