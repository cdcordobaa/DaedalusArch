/** A sum of money on the platform, held in cents. The platform runs in one currency (EUR). Immutable. */
export class Amount {
  static readonly ZERO = new Amount(0);

  private constructor(readonly cents: number) {}

  static ofUnits(units: number): Amount {
    if (!Number.isFinite(units)) throw new Error('an amount must be a number');
    return new Amount(Math.round(units * 100));
  }

  static ofCents(cents: number): Amount {
    if (!Number.isInteger(cents)) throw new Error('cents must be a whole number');
    return new Amount(cents);
  }

  add(other: Amount): Amount {
    return new Amount(this.cents + other.cents);
  }

  subtract(other: Amount): Amount {
    return new Amount(this.cents - other.cents);
  }

  isPositive(): boolean {
    return this.cents > 0;
  }

  exceeds(other: Amount): boolean {
    return this.cents > other.cents;
  }

  reaches(other: Amount): boolean {
    return this.cents >= other.cents;
  }

  units(): number {
    return this.cents / 100;
  }

  label(): string {
    return `EUR ${(this.cents / 100).toFixed(2)}`;
  }
}
