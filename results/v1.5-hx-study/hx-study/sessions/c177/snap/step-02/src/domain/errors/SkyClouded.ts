import { BookingRefused } from './BookingRefused';

/** The sky is overcast; the dome stays closed. May carry the next clear evening. */
export class SkyClouded extends BookingRefused {
  constructor(readonly nextClearEvening?: string) {
    super('Clouds tonight: the dome stays closed.');
    this.name = 'SkyClouded';
  }
}
