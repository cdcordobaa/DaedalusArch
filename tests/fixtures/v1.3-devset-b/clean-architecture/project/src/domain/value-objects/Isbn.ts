import { DomainError } from '../errors/DomainError';

export class Isbn {
  private constructor(readonly value: string) {}

  static parse(raw: string): Isbn {
    const digits = raw.replace(/-/g, '');
    if (!/^\d{13}$/.test(digits)) {
      throw new DomainError('INVALID_ISBN', `ISBN must have 13 digits: ${raw}`);
    }
    return new Isbn(digits);
  }

  equals(other: Isbn): boolean {
    return this.value === other.value;
  }
}
