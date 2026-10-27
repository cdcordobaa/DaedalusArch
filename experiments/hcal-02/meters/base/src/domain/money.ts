export class Money {
  constructor(readonly cents: number, readonly currency: string) {}

  static zero(currency: string): Money {
    return new Money(0, currency);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents, this.currency);
  }
}
