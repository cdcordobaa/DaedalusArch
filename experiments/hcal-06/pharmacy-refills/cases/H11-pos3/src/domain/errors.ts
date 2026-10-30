export class DomainError extends Error {}

export class RefillNotFoundError extends DomainError {
  constructor(refillId: string) {
    super(`refill ${refillId} not found`);
  }
}

export class RefillClosedError extends DomainError {
  constructor(refillId: string) {
    super(`refill ${refillId} already has a coverage decision`);
  }
}

export class CoverageUnavailableError extends DomainError {}

const REJECTION_TEXT: Readonly<Record<string, string>> = {
  R70: 'the product is not covered by the plan',
  R76: 'the quantity is above the plan limit',
  R79: 'the refill is too soon',
  R88: 'a drug utilisation review is needed',
};

export class CoverageRejectedError extends DomainError {
  constructor(readonly rejectCode: string) {
    super(REJECTION_TEXT[rejectCode] ?? `coverage rejected (${rejectCode})`);
  }
}
