import { DomainError } from '../catalog/errors';

export class InvalidEmailError extends DomainError {
  constructor(value: string) {
    super('INVALID_EMAIL', `"${value}" is not a valid e-mail address`);
  }
}

/** A lower-cased e-mail address. Immutable. */
export class Email {
  private constructor(readonly value: string) {}

  static of(raw: string): Email {
    const v = raw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new InvalidEmailError(raw);
    return new Email(v);
  }
}
