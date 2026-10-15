/** An amount in minor units (cents); the space bills in one currency. */
export class Money {
  readonly cents: number;

  constructor(cents: number) {
    this.cents = Math.round(cents);
  }

  static euros(amount: number): Money {
    return new Money(amount * 100);
  }

  times(factor: number): Money {
    return new Money(this.cents * factor);
  }

  plus(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  /** Applies a percentage discount, rounding in the member's favour. */
  discounted(percent: number): Money {
    return new Money(Math.floor((this.cents * (100 - percent)) / 100));
  }
}
