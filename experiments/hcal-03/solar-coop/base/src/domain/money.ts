export class Money {
  private constructor(readonly cents: number) {}
  static ofCents(cents: number): Money {
    return new Money(Math.round(cents));
  }
  static zero(): Money {
    return new Money(0);
  }
  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }
  isPositive(): boolean {
    return this.cents > 0;
  }
}
