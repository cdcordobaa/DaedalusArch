import { InvalidIsbnError } from './errors';

/** An ISBN-13 whose check digit is valid. Immutable. */
export class Isbn {
  private constructor(readonly value: string) {}

  static of(raw: string): Isbn {
    const digits = raw.replace(/[-\s]/g, '');
    if (!/^\d{13}$/.test(digits)) throw new InvalidIsbnError(raw);
    const sum = [...digits.slice(0, 12)].reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
    const check = (10 - (sum % 10)) % 10;
    if (check !== Number(digits[12])) throw new InvalidIsbnError(raw);
    return new Isbn(digits);
  }

  equals(other: Isbn): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
