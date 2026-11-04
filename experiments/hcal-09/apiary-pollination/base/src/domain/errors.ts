export class DomainError extends Error {}

export class PlacementNotFoundError extends DomainError {
  constructor(ref: string) {
    super(`placement ${ref} not found`);
  }
}

export class PlacementNotBookedError extends DomainError {
  constructor(id: string) {
    super(`placement ${id} is no longer booked`);
  }
}

export class ColoniesNotReadyError extends DomainError {
  constructor(id: string) {
    super(`placement ${id}: too few colonies are fit to go out`);
  }
}

export class SensorsUnavailableError extends DomainError {}
