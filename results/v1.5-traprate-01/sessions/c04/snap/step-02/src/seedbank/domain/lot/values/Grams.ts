import { LibraryRefusal } from '../../LibraryRefusal';

/** A weight of seed in whole grams. Immutable. */
export class Grams {
  private constructor(readonly value: number) {}

  static of(value: number): Grams {
    if (!Number.isInteger(value)) throw new LibraryRefusal(`seed is weighed in whole grams, not ${String(value)}`);
    return new Grams(value);
  }

  plus(other: Grams): Grams {
    return new Grams(this.value + other.value);
  }

  minus(other: Grams): Grams {
    return new Grams(this.value - other.value);
  }

  isPositive(): boolean {
    return this.value > 0;
  }

  exceeds(other: Grams): boolean {
    return this.value > other.value;
  }

  toString(): string {
    return `${String(this.value)} g`;
  }
}
