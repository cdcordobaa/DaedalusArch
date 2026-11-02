import { BookingRefused } from './BookingRefused';

/** The sky is overcast; the dome stays closed. A later clear evening may be known. */
export class CloudedOut extends BookingRefused {
  constructor(readonly nextClearEvening?: string) {
    super('Clouds tonight: the dome stays closed.');
    this.name = 'CloudedOut';
  }
}
