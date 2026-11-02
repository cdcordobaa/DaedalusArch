import { BookingRefused } from './BookingRefused';

/** The evening has no seats left; the guest may be offered another evening. */
export class EveningFullyBooked extends BookingRefused {
  constructor(message = 'This evening is fully booked.') {
    super(message);
    this.name = 'EveningFullyBooked';
  }
}
