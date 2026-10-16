/** A business rule was broken; the message is safe to show to the caller. */
export class DomainError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class InvalidIsbnError extends DomainError {
  constructor(value: string) {
    super('INVALID_ISBN', `"${value}" is not a valid ISBN-13`);
  }
}

export class InvalidBookError extends DomainError {
  constructor(reason: string) {
    super('INVALID_BOOK', reason);
  }
}

export class DuplicateBookError extends DomainError {
  constructor(isbn: string) {
    super('DUPLICATE_BOOK', `a book with ISBN ${isbn} is already registered`);
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string) {
    super('NOT_FOUND', `${what} not found`);
  }
}
