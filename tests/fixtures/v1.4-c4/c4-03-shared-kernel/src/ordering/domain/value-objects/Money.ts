export class Money {
  constructor(readonly cents: number, readonly currency: string) {}

  plus(other: Money): Money {
    if (other.currency !== this.currency) throw new Error('currency mismatch');
    return new Money(this.cents + other.cents, this.currency);
  }
}
