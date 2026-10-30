export class DomainError extends Error {}

export class ParcelNotFoundError extends DomainError {
  constructor(parcelId: string) {
    super(`parcel ${parcelId} not found`);
  }
}

export class WrongPickupCodeError extends DomainError {
  readonly statusCode: number;

  constructor(parcelId: string) {
    super(`wrong pickup code for parcel ${parcelId}`);
    this.statusCode = 409;
  }
}

export class LockerUnavailableError extends DomainError {}
