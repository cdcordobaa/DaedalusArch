import { EntryError } from './EntryError';

/** The rating source cannot be asked right now; the caller may retry after the given seconds. */
export class RegistrationBusyError extends EntryError {
  constructor(readonly retryAfterSeconds: number) {
    super('Registration is busy, please try again shortly.');
    this.name = 'RegistrationBusyError';
  }
}
