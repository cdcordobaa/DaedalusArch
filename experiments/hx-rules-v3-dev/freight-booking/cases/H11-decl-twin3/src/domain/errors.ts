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

export class CarrierDeclinedBookingError extends DomainError {
  constructor(readonly bookingId: string) {
    super(`carrier declined booking ${bookingId}`);
  }
}
