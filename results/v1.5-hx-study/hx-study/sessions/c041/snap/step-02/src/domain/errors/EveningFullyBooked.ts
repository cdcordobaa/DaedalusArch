import { BookingRefused } from './BookingRefused';

/** The chosen evening has no seats left; the guest can be offered another evening. */
export class EveningFullyBooked extends BookingRefused {
  readonly statusCode = 409;

  constructor() {
    super('This evening is fully booked.');
    this.name = 'EveningFullyBooked';
  }
}
