/** An entry the congress turns down. */
export class EntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntryError';
  }
}

/** The rating service does not know the federation id; the entry form answers 404. */
export class UnknownPlayerError extends EntryError {
  readonly statusCode = 404;
  constructor(message = 'No player with this federation id.') {
    super(message);
    this.name = 'UnknownPlayerError';
  }
}
