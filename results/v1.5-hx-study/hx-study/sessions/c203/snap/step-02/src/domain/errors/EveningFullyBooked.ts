import { BookingRefused } from './BookingRefused';

/** The evening has no seats left; another evening may be offered. */
export class EveningFullyBooked extends BookingRefused {
  constructor() {
    super('This evening is fully booked.');
    this.name = 'EveningFullyBooked';
  }
}
