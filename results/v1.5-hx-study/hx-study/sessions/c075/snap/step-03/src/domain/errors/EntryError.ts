/** An entry the congress turns down. */
export class EntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntryError';
  }
}

/** The rating service asks us to slow down; the entry form answers 503 with Retry-After. */
export class RegistrationBusyError extends EntryError {
  readonly statusCode = 503;
  constructor(readonly retryAfterSeconds: number = 20) {
    super('Registration is busy, please try again shortly.');
    this.name = 'RegistrationBusyError';
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
