/** Value object: an amount in minor units of one currency. */
export class Money {
  constructor(readonly cents: number, readonly currency: string) {
    if (!Number.isInteger(cents)) throw new Error('Money is a whole number of cents');
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) throw new Error('Currency mismatch');
    return new Money(this.cents + other.cents, this.currency);
  }
}
