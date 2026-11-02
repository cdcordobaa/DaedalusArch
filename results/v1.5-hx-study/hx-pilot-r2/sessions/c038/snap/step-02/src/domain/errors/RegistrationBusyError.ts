import { EntryError } from './EntryError';

/** The rating authority asks us to wait before asking again. */
export class RegistrationBusyError extends EntryError {
  constructor(readonly retryAfterSeconds: number) {
    super('Registration is busy, please try again shortly.');
    this.name = 'RegistrationBusyError';
  }
}
