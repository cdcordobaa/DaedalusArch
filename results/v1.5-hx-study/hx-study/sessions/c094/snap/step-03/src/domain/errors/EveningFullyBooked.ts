import { BookingRefused } from './BookingRefused';

/** The chosen evening has no seats left; another evening can be offered. */
export class EveningFullyBooked extends BookingRefused {
  constructor() {
    super('This evening is fully booked.');
    this.name = 'EveningFullyBooked';
  }
}
