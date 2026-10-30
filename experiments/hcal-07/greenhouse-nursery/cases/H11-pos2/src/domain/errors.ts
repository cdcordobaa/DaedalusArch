import { FreightRefusal } from './freight';

export class DomainError extends Error {}

export class DispatchNotFoundError extends DomainError {
  constructor(ref: string) {
    super(`dispatch ${ref} not found`);
  }
}

export class DispatchNotOrderedError extends DomainError {
  constructor(dispatchId: string) {
    super(`dispatch ${dispatchId} already has freight booked`);
  }
}

export class DispatchNotBookedError extends DomainError {
  constructor(dispatchId: string) {
    super(`dispatch ${dispatchId} has no freight booked`);
  }
}

export class FreightRefusedError extends DomainError {
  constructor(
    readonly refusal: FreightRefusal,
    readonly carrierCode: string,
  ) {
    super(`freight refused: ${refusal}`);
  }
}

export class CarrierUnavailableError extends DomainError {}
