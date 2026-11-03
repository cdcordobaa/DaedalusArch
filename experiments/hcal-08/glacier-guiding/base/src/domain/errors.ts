export class DomainError extends Error {}

export class BookingNotFoundError extends DomainError {
  constructor(ref: string) {
    super(`booking ${ref} not found`);
  }
}

export class BookingNotRequestedError extends DomainError {
  constructor(bookingId: string) {
    super(`booking ${bookingId} was already decided`);
  }
}

export class PermitRegistryUnavailableError extends DomainError {}
