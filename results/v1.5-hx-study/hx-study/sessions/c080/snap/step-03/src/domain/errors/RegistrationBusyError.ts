import { EntryError } from './EntryError';

/** The rating authority asked us to slow down; try again after the given number of seconds. */
export class RegistrationBusyError extends EntryError {
  constructor(readonly retryAfterSeconds: number) {
    super('Registration is busy, please try again shortly.');
    this.name = 'RegistrationBusyError';
  }
}
