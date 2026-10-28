export class Money {
  constructor(readonly cents: number, readonly currency: string = 'USD') {}
  add(other: Money): Money { return new Money(this.cents + other.cents, this.currency); }
  times(factor: number): Money { return new Money(Math.round(this.cents * factor), this.currency); }
}
