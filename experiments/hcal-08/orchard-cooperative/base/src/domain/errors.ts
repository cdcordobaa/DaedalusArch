export class DomainError extends Error {}

export class LotNotFoundError extends DomainError {
  constructor(ref: string) {
    super(`harvest lot ${ref} not found`);
  }
}

export class LotNotReceivedError extends DomainError {
  constructor(lotId: string) {
    super(`harvest lot ${lotId} was already sent to the press`);
  }
}

export class PressingUnavailableError extends DomainError {}
