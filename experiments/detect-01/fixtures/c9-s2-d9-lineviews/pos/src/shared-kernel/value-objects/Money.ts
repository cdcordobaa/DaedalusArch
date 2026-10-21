/** Shared kernel value object: an amount in cents of one currency. */
export class Money {
  private constructor(readonly cents: number, readonly currency: string) {}

  static of(cents: number, currency: string): Money {
    if (!Number.isInteger(cents) || cents < 0) throw new Error('Money is a non-negative whole number of cents');
    return new Money(cents, currency);
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) throw new Error('Currency mismatch');
    return new Money(this.cents + other.cents, this.currency);
  }
}
