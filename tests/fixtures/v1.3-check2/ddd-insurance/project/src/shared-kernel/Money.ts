export class Money {
  constructor(readonly cents: number) {
    if (!Number.isInteger(cents)) throw new Error('Money is counted in whole cents');
  }

  plus(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  minus(other: Money): Money {
    return new Money(Math.max(0, this.cents - other.cents));
  }

  min(other: Money): Money {
    return this.cents <= other.cents ? this : other;
  }
}
