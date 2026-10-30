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
  constructor(readonly refusal: FreightRefusal) {
    super(`freight refused: ${refusal}`);
  }
}

export class OverweightLoadError extends DomainError {
  constructor(dispatchId: string, weightKg: number) {
    super(`dispatch ${dispatchId} weighs ${weightKg} kg, over the nursery's load limit`);
  }
}

export class CarrierUnavailableError extends DomainError {}
