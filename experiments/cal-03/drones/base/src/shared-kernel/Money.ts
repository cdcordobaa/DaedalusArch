export class Money {
  private constructor(
    readonly cents: number,
    readonly currency: string,
  ) {}

  static of(cents: number, currency = 'USD'): Money {
    if (!Number.isInteger(cents) || cents < 0) {
      throw new Error('invalid money amount');
    }
    return new Money(cents, currency);
  }

  static zero(currency = 'USD'): Money {
    return new Money(0, currency);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents, this.currency);
  }

  times(factor: number): Money {
    return new Money(Math.round(this.cents * factor), this.currency);
  }

  isPositive(): boolean {
    return this.cents > 0;
  }
}
