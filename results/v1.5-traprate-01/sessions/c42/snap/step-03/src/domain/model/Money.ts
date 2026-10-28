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

  /** This amount plus a surcharge given in basis points, rounded to the nearest cent. */
  plusSurcharge(basisPoints: number): Money {
    return new Money(this.cents + Math.round((this.cents * basisPoints) / 10000), this.currency);
  }

  isPositive(): boolean {
    return this.cents > 0;
  }

  amount(): number {
    return this.cents / 100;
  }
}
