import { BusinessError } from '../errors/BusinessError';

/** Value object (Fowler 2002, "Money"): an amount in cents. */
export class Money {
  private constructor(readonly cents: number) {}

  static ofCents(cents: number): Money {
    if (!Number.isInteger(cents) || cents < 0) throw new BusinessError('INVALID', `Invalid amount: ${cents}`);
    return new Money(cents);
  }

  static zero(): Money {
    return new Money(0);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return Money.ofCents(Math.max(0, this.cents - other.cents));
  }

  times(quantity: number): Money {
    return Money.ofCents(this.cents * quantity);
  }

  percent(rate: number): Money {
    return Money.ofCents(Math.round((this.cents * rate) / 100));
  }

  format(): string {
    return `${(this.cents / 100).toFixed(2)} EUR`;
  }
}
