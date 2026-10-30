import { BookingRefused } from './BookingRefused';

/** The sky is overcast and the dome stays closed; the next clear evening may be known. */
export class CloudedOut extends BookingRefused {
  constructor(readonly nextClearEvening?: string) {
    super('Clouds tonight: the dome stays closed.');
    this.name = 'CloudedOut';
  }
}
