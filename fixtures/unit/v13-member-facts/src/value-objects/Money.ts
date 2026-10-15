/** Immutable: readonly parameter properties; operations return new instances. */
export class Money {
  static readonly ZERO_CURRENCY = 'XXX';

  private constructor(readonly cents: number, public readonly currency: string) {}

  static of(cents: number, currency: string): Money {
    return new Money(cents, currency);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents, this.currency);
  }
}
