import { InvalidPeriodError } from './errors';

export class Money {
  constructor(
    readonly amount: number,
    readonly currency: string,
  ) {}

  add(other: Money): Money {
    return new Money(this.amount + other.amount, this.currency);
  }

  toString(): string {
    return `${this.amount.toFixed(2)} ${this.currency}`;
  }
}

export class DateRange {
  constructor(
    readonly start: Date,
    readonly end: Date,
  ) {
    if (end.getTime() < start.getTime()) throw new InvalidPeriodError();
  }

  days(): number {
    return Math.ceil((this.end.getTime() - this.start.getTime()) / 86_400_000);
  }
}
