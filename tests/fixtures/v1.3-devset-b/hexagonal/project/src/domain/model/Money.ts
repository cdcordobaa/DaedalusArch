import { BookingError } from '../errors/BookingError';

export class Money {
  private constructor(readonly cents: number) {}

  static ofCents(cents: number): Money {
    if (!Number.isInteger(cents) || cents < 0) throw new BookingError('invalid', `Invalid amount: ${cents}`);
    return new Money(cents);
  }

  times(factor: number): Money {
    return Money.ofCents(this.cents * factor);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }
}
