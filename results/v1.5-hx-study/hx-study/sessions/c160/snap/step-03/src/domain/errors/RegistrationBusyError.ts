import { EntryError } from './EntryError';

/** Registration cannot take the entry right now; the player may try again after retryAfterSeconds. */
export class RegistrationBusyError extends EntryError {
  constructor(readonly retryAfterSeconds: number) {
    super('Registration is busy, please try again shortly.', 503);
    this.name = 'RegistrationBusyError';
  }
}
