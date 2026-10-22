export class Money {
  private constructor(readonly cents: number, readonly currency: string) {}

  static of(cents: number, currency = 'EUR'): Money {
    return new Money(cents, currency);
  }

  plus(other: Money): Money {
    return new Money(this.cents + other.cents, this.currency);
  }
}
