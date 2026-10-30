import { EntryError } from './EntryError';

/** The rating list cannot be asked right now; it can be asked again after the given seconds. */
export class RatingsBusy extends EntryError {
  constructor(readonly retryInSeconds: number) {
    super('Registration is busy, please try again shortly.');
    this.name = 'RatingsBusy';
  }
}
