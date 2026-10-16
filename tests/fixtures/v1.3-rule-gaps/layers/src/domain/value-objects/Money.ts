export class Money {
  constructor(readonly cents: number) {}
  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }
}
