import { BookingRefused } from './BookingRefused';

/** The sky is overcast, so the dome stays closed; the next clear evening, when the dome knows it. */
export class SkyClosed extends BookingRefused {
  constructor(readonly nextClearEvening?: string) {
    super('Clouds tonight: the dome stays closed.');
    this.name = 'SkyClosed';
  }
}
