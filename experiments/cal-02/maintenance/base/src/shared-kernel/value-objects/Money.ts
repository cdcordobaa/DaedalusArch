export class Money {
  private constructor(readonly cents: number) {}

  static of(cents: number): Money {
    if (!Number.isInteger(cents) || cents < 0) {
      throw new Error('invalid amount');
    }
    return new Money(cents);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  isGreaterThan(other: Money): boolean {
    return this.cents > other.cents;
  }
}
