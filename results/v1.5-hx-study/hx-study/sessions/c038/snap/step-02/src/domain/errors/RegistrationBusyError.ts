import { EntryError } from './EntryError';

/** The rating source is rate limiting us; the entry can be retried after the given number of seconds. */
export class RegistrationBusyError extends EntryError {
  constructor(readonly retryAfterSeconds: number) {
    super('Registration is busy, please try again shortly.');
    this.name = 'RegistrationBusyError';
  }
}
