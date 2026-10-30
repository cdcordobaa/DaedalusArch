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

export type HoldReason = 'lane-closed' | 'over-limit' | 'papers-missing' | 'manual-review';

const HOLD_TEXT: Readonly<Record<HoldReason, string>> = {
  'lane-closed': 'the lane is closed for the week',
  'over-limit': 'the pallets are over the lane limit',
  'papers-missing': 'the customs papers are missing',
  'manual-review': 'the carrier needs a manual review',
};

export class BookingHeldError extends DomainError {
  constructor(readonly reason: HoldReason) {
    super(HOLD_TEXT[reason]);
  }
}
