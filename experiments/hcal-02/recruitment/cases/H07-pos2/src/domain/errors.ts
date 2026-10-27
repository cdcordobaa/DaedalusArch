export class DomainError extends Error {
  constructor(readonly code: string, message: string, readonly httpStatus: number = 500) {
    super(message);
    this.name = new.target.name;
  }
}

export class OpeningClosedError extends DomainError {
  constructor(openingId: string) {
    super("OPENING_CLOSED", `Opening ${openingId} is closed`, 410);
  }
}

export class DuplicateApplicationError extends DomainError {
  constructor(openingId: string, email: string) {
    super("DUPLICATE_APPLICATION", `${email} already applied to ${openingId}`, 409);
  }
}

export class NotFoundError extends DomainError {
  constructor(kind: string, id: string) {
    super("NOT_FOUND", `${kind} ${id} not found`, 404);
  }
}

export class InvalidEmailError extends DomainError {
  constructor(raw: string) {
    super("INVALID_EMAIL", `Invalid email: ${raw}`);
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super("INVALID_TRANSITION", `Cannot move from ${from} to ${to}`);
  }
}
