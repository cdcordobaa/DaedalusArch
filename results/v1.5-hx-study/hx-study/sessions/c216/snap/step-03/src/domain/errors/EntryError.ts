/** An entry the congress turns down. `statusCode` optionally tells the entry form which HTTP status fits the refusal. */
export class EntryError extends Error {
  constructor(message: string, readonly statusCode?: number) {
    super(message);
    this.name = 'EntryError';
  }
}

/** The rating source is rate limiting us; the entry may be retried after `retryAfterSeconds`. */
export class RegistrationBusyError extends EntryError {
  constructor(readonly retryAfterSeconds: number) {
    super('Registration is busy, please try again shortly.', 503);
    this.name = 'RegistrationBusyError';
  }
}
