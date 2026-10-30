export class DomainError extends Error {}

export class BookingNotFoundError extends DomainError {
  constructor(bookingId: string) {
    super(`booking ${bookingId} not found`);
  }
}

export class BookingClosedError extends DomainError {
  constructor(bookingId: string) {
    super(`booking ${bookingId} already has a carrier answer`);
  }
}

export class CarrierUnavailableError extends DomainError {}

const HOLD_TEXT: Readonly<Record<string, string>> = {
  H10: 'the lane is closed for the week',
  H22: 'the pallets are over the lane limit',
  H31: 'the customs papers are missing',
  H47: 'the carrier needs a manual review',
};

export class BookingHeldError extends DomainError {
  constructor(readonly holdCode: string) {
    super(HOLD_TEXT[holdCode] ?? `booking held (${holdCode})`);
  }
}
