import { BookingRefused } from './BookingRefused';

/** The chosen evening has no seats left; the booking page should offer another one. */
export class EveningFullyBooked extends BookingRefused {
  readonly statusCode = 409;
  constructor() {
    super('This evening is fully booked.');
    this.name = 'EveningFullyBooked';
  }
}
