export class Money {
  private constructor(
    readonly cents: number,
    readonly currency: string,
  ) {}

  static of(cents: number, currency: string): Money {
    if (!Number.isInteger(cents) || cents < 0) throw new Error("invalid money amount");
    return new Money(cents, currency);
  }

  times(factor: number): Money {
    return Money.of(this.cents * factor, this.currency);
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) throw new Error("currency mismatch");
    return Money.of(this.cents + other.cents, this.currency);
  }
}
