import { EntryError } from './EntryError';

/** The rating source asked us to slow down; entering may be retried after the given seconds. */
export class RegistrationBusyError extends EntryError {
  constructor(readonly retryAfterSeconds: number, message = 'Registration is busy, please try again shortly.') {
    super(message);
    this.name = 'RegistrationBusyError';
  }
}
