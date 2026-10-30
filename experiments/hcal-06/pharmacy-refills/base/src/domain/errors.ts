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
