/** An amount of money in minor units (cents) and a currency code. Immutable. */
export class Money {
  private constructor(
    readonly cents: number,
    readonly currency: string,
  ) {}

  static of(amount: number, currency: string): Money {
    return new Money(Math.round(amount * 100), currency);
  }

  static ofCents(cents: number, currency: string): Money {
    return new Money(cents, currency);
  }

  plus(other: Money): Money {
    if (other.currency !== this.currency) throw new Error(`currency mismatch: ${this.currency} vs ${other.currency}`);
    return new Money(this.cents + other.cents, this.currency);
  }

  /** This amount times a rate given in basis points (150 = 1.5%), rounded to the nearest cent. */
  basisPoints(points: number): Money {
    return new Money(Math.round((this.cents * points) / 10000), this.currency);
  }

  isPositive(): boolean {
    return this.cents > 0;
  }

  amount(): number {
    return this.cents / 100;
  }
}
