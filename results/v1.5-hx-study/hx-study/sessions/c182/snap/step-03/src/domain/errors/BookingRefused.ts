/** A booking the observatory cannot take. */
export class BookingRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingRefused';
  }
}

/** The sky is overcast; the dome stays closed. May carry the next clear evening. */
export class CloudedOut extends BookingRefused {
  readonly statusCode = 423;
  readonly headers: Readonly<Record<string, string>>;
  constructor(nextClearEvening?: string) {
    super('Clouds tonight: the dome stays closed.');
    this.name = 'CloudedOut';
    this.headers = nextClearEvening ? { 'Next-Clear-Evening': nextClearEvening } : {};
  }
}

/** The evening has no seats left; the booking page can offer another evening. */
export class EveningFullyBooked extends BookingRefused {
  readonly statusCode = 409;
  constructor() {
    super('This evening is fully booked.');
    this.name = 'EveningFullyBooked';
  }
}
