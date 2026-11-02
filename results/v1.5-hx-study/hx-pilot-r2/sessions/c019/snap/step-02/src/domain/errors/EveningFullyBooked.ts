import { BookingRefused } from './BookingRefused';

/** The evening has no seats left; the booking page should offer another evening. */
export class EveningFullyBooked extends BookingRefused {
  readonly statusCode = 409;
  constructor() {
    super('This evening is fully booked.');
    this.name = 'EveningFullyBooked';
  }
}
