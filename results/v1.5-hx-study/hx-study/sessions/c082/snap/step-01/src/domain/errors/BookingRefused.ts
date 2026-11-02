/** A booking the observatory cannot take. */
export class BookingRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingRefused';
  }
}

/** The chosen evening has no seats left; the booking page should offer another evening. */
export class EveningFullyBooked extends BookingRefused {
  readonly statusCode = 409;
  constructor() {
    super('This evening is fully booked.');
    this.name = 'EveningFullyBooked';
  }
}
