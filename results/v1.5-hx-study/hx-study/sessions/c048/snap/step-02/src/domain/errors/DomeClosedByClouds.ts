import { BookingRefused } from './BookingRefused';

/** The sky is overcast; the dome stays closed. */
export class DomeClosedByClouds extends BookingRefused {
  constructor(readonly nextClearEvening?: string) {
    super('Clouds tonight: the dome stays closed.');
    this.name = 'DomeClosedByClouds';
  }
}
