import { EntryError } from './EntryError';

/** The rating source is rate limiting us; the entry may be retried after a while. */
export class RegistrationBusyError extends EntryError {
  constructor(readonly retryAfterSeconds: number) {
    super('Registration is busy, please try again shortly.');
    this.name = 'RegistrationBusyError';
  }
}
