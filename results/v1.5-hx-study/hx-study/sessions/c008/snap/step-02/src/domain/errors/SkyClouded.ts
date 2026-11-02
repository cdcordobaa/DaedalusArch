import { BookingRefused } from './BookingRefused';

/** The sky is overcast tonight; the dome stays closed. */
export class SkyClouded extends BookingRefused {
  constructor(readonly nextClearEvening?: string) {
    super('Clouds tonight: the dome stays closed.');
    this.name = 'SkyClouded';
  }
}
