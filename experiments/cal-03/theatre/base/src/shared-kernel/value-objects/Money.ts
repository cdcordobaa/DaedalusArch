export class Money {
  private constructor(
    readonly amount: number,
    readonly currency: string,
  ) {}

  static of(amount: number, currency = 'USD'): Money {
    return new Money(amount, currency);
  }

  isPositive(): boolean {
    return this.amount > 0;
  }

  times(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  add(other: Money): Money {
    return new Money(this.amount + other.amount, this.currency);
  }
}
