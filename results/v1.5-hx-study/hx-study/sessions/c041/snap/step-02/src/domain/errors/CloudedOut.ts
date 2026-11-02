import { BookingRefused } from './BookingRefused';

/** The sky is overcast; the dome stays closed. May carry the next clear evening. */
export class CloudedOut extends BookingRefused {
  readonly statusCode = 423;

  constructor(readonly nextClearEvening?: string) {
    super('Clouds tonight: the dome stays closed.');
    this.name = 'CloudedOut';
  }
}
