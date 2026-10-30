import { BookingRefused } from './BookingRefused';

/** Every seat under the dome is taken that evening. */
export class EveningFull extends BookingRefused {
  constructor(readonly evening: string) {
    super('This evening is fully booked.');
    this.name = 'EveningFull';
  }
}
