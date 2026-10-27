export class Money {
  private constructor(readonly cents: number, readonly currency: string) {}

  static of(cents: number, currency = 'USD'): Money {
    if (!Number.isInteger(cents)) throw new RangeError('cents must be an integer');
    return new Money(cents, currency);
  }

  static zero(currency = 'USD'): Money {
    return new Money(0, currency);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents, this.currency);
  }

  subtract(other: Money): Money {
    return new Money(this.cents - other.cents, this.currency);
  }

  percent(p: number): Money {
    return new Money(Math.round((this.cents * p) / 100), this.currency);
  }
}
