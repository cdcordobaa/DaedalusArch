/** A booking the observatory cannot take. */
export class BookingRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingRefused';
  }
}

/** The sky is overcast; the dome stays closed. */
export class CloudedOut extends BookingRefused {
  readonly statusCode = 423;
  constructor(readonly nextClearEvening?: string) {
    super('Clouds tonight: the dome stays closed.');
    this.name = 'CloudedOut';
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
