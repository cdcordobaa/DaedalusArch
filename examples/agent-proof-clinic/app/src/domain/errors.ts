export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`);
    this.name = "NotFoundError";
  }
}

export class SlotUnavailableError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "SlotUnavailableError";
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class InvalidStateError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStateError";
  }
}
