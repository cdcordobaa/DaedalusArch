export class DomainError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class OpeningClosedError extends DomainError {
  constructor(openingId: string) {
    super("OPENING_CLOSED", `Opening ${openingId} is closed`);
  }
}

export class DuplicateApplicationError extends DomainError {
  constructor(openingId: string, email: string) {
    super("DUPLICATE_APPLICATION", `${email} already applied to ${openingId}`);
  }
}

export class NotFoundError extends DomainError {
  constructor(kind: string, id: string) {
    super("NOT_FOUND", `${kind} ${id} not found`);
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
