import { InvalidReadingError } from "./errors";

export class Kwh {
  private constructor(readonly value: number) {}

  static of(value: number): Kwh {
    if (!Number.isFinite(value) || value < 0) {
      throw new InvalidReadingError("kWh must be a non-negative number");
    }
    return new Kwh(value);
  }

  minus(other: Kwh): Kwh {
    return Kwh.of(this.value - other.value);
  }

  isAtLeast(other: Kwh): boolean {
    return this.value >= other.value;
  }
}
