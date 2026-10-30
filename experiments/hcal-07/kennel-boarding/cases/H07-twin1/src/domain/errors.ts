import { RefusalReason } from './deposit';

export class DomainError extends Error {}

export class BookingNotFoundError extends DomainError {
  readonly code = 'BOOKING_NOT_FOUND';

  constructor(bookingId: string) {
    super(`booking ${bookingId} not found`);
  }
}

export class BookingNotRequestedError extends DomainError {
  constructor(bookingId: string) {
    super(`booking ${bookingId} is not awaiting confirmation`);
  }
}

export class BookingNotConfirmedError extends DomainError {
  constructor(bookingId: string) {
    super(`booking ${bookingId} is not confirmed`);
  }
}

export class DepositRefusedError extends DomainError {
  readonly code = 'DEPOSIT_REFUSED';

  constructor(readonly reason: RefusalReason) {
    super(`deposit refused: ${reason}`);
  }
}

export class PaymentProviderUnavailableError extends DomainError {}
