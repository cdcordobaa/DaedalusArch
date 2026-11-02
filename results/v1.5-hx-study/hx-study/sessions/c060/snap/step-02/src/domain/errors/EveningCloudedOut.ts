import { BookingRefused } from './BookingRefused';

/** The sky is overcast; the dome stays closed. */
export class EveningCloudedOut extends BookingRefused {
  readonly statusCode = 423;
  constructor(readonly nextClearEvening?: string) {
    super('Clouds tonight: the dome stays closed.');
    this.name = 'EveningCloudedOut';
  }
}
