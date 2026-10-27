export class Money {
  private constructor(
    readonly cents: number,
    readonly currency: string,
  ) {}

  static of(cents: number, currency = "USD"): Money {
    if (!Number.isInteger(cents) || cents < 0) {
      throw new Error("money must be a non-negative integer");
    }
    return new Money(cents, currency);
  }

  static zero(currency = "USD"): Money {
    return new Money(0, currency);
  }

  plus(other: Money): Money {
    this.sameCurrency(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  minus(other: Money): Money {
    this.sameCurrency(other);
    return Money.of(this.cents - other.cents, this.currency);
  }

  isGreaterThan(other: Money): boolean {
    this.sameCurrency(other);
    return this.cents > other.cents;
  }

  private sameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new Error("currency mismatch");
    }
  }
}
