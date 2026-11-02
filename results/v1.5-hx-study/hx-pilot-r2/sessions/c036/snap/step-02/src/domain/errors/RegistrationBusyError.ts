import { EntryError } from './EntryError';

/** The rating source asked us to slow down; the entry may be retried after `retryAfterSeconds`. */
export class RegistrationBusyError extends EntryError {
  readonly statusCode = 503;
  constructor(readonly retryAfterSeconds: number) {
    super('Registration is busy, please try again shortly.');
    this.name = 'RegistrationBusyError';
  }
}
