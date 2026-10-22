/** An amount of money in minor units (cents) and a currency code. Immutable. */
export class Money {
  private constructor(
    readonly cents: number,
    readonly currency: string,
  ) {}

  static of(amount: number, currency: string): Money {
    return new Money(Math.round(amount * 100), currency);
  }

  static zero(currency: string): Money {
    return new Money(0, currency);
  }

  plus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents - other.cents, this.currency);
  }

  isNegative(): boolean {
    return this.cents < 0;
  }

  isPositive(): boolean {
    return this.cents > 0;
  }

  amount(): number {
    return this.cents / 100;
  }

  format(): string {
    return `${this.currency} ${(this.cents / 100).toFixed(2)}`;
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) throw new Error(`currency mismatch: ${this.currency} vs ${other.currency}`);
  }
}
