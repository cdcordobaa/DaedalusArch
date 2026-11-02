import { EntryError } from './EntryError';

/** The rating source cannot be asked right now; the player may try again after `retryAfterSeconds`. */
export class RegistrationBusyError extends EntryError {
  readonly statusCode = 503;

  constructor(readonly retryAfterSeconds: number) {
    super('Registration is busy, please try again shortly.');
    this.name = 'RegistrationBusyError';
  }
}
