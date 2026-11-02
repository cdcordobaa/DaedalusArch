import { BookingRefused } from './BookingRefused';

/** The sky is overcast; the dome stays closed. The next clear evening may be known. */
export class EveningCloudedOut extends BookingRefused {
  constructor(readonly nextClearEvening?: string, message = 'Clouds tonight: the dome stays closed.') {
    super(message);
    this.name = 'EveningCloudedOut';
  }
}
