import { BookingRefused } from './BookingRefused';

/** The evening has no seats left; the booking page should offer another one. */
export class EveningFull extends BookingRefused {
  readonly statusCode = 409;
  constructor() {
    super('This evening is fully booked.');
    this.name = 'EveningFull';
  }
}
