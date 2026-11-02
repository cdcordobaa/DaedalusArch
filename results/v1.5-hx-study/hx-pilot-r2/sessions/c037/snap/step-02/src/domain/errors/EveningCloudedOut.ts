import { BookingRefused } from './BookingRefused';

/** The sky is overcast and the dome stays closed; a clear evening may be known. */
export class EveningCloudedOut extends BookingRefused {
  constructor(readonly nextClearEvening?: string) {
    super('Clouds tonight: the dome stays closed.');
    this.name = 'EveningCloudedOut';
  }
}
