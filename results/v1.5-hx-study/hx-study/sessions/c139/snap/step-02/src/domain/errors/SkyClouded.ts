import { BookingRefused } from './BookingRefused';

/** The sky is overcast; the dome stays closed. The next clear evening is known only sometimes. */
export class SkyClouded extends BookingRefused {
  constructor(readonly nextClearEvening?: string) {
    super('Clouds tonight: the dome stays closed.');
    this.name = 'SkyClouded';
  }
}
