import { RefusalReason } from './deposit';

export class DomainError extends Error {}

export class BookingNotFoundError extends DomainError {
  readonly httpStatus = 404;

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
  readonly httpStatus = 402;

  constructor(readonly reason: RefusalReason) {
    super(`deposit refused: ${reason}`);
  }
}

export class PaymentProviderUnavailableError extends DomainError {}
