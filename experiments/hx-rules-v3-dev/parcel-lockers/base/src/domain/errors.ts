export class DomainError extends Error {}

export class ParcelNotFoundError extends DomainError {
  constructor(parcelId: string) {
    super(`parcel ${parcelId} not found`);
  }
}

export class WrongPickupCodeError extends DomainError {
  constructor(parcelId: string) {
    super(`wrong pickup code for parcel ${parcelId}`);
  }
}

export class LockerUnavailableError extends DomainError {}
