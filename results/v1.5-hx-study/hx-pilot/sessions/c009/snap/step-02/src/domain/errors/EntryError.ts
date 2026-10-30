/** An entry the congress turns down. */
export class EntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntryError';
  }
}

/** The rating service asked us to slow down; the entry can be retried after `retryAfterSeconds`. */
export class RegistrationBusyError extends EntryError {
  constructor(readonly retryAfterSeconds: number) {
    super('Registration is busy, please try again shortly.');
    this.name = 'RegistrationBusyError';
  }
}
