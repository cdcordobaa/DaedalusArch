import { BookingRefused } from './BookingRefused';

/** The evening has no seats left; the guest can be offered another evening. */
export class EveningFullyBooked extends BookingRefused {
  constructor() {
    super('This evening is fully booked.');
    this.name = 'EveningFullyBooked';
  }
}
