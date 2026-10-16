/** Value object: an amount in minor units and a currency. Immutable; operations return new instances. */
export class Money {
  private constructor(readonly cents: number, readonly currency: string) {}

  static of(cents: number, currency: string): Money {
    if (!Number.isInteger(cents)) throw new Error('Money is held in whole minor units');
    return new Money(cents, currency);
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) throw new Error('Currency mismatch');
    return new Money(this.cents + other.cents, this.currency);
  }

  times(factor: number): Money {
    return new Money(Math.round(this.cents * factor), this.currency);
  }

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }
}
