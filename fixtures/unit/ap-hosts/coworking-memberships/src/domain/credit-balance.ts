import { DomainError } from './domain-error';

export class InsufficientCreditsError extends DomainError {
  constructor(needed: number, left: number) {
    super('INSUFFICIENT_CREDITS', `The booking needs ${String(needed)} meeting credits; ${String(left)} left this month`);
  }
}

/** Monthly meeting-room credits of a membership. */
export class CreditBalance {
  readonly credits: number;

  constructor(credits: number) {
    this.credits = credits;
  }

  spend(amount: number): CreditBalance {
    if (amount > this.credits) {
      throw new InsufficientCreditsError(amount, this.credits);
    }
    return new CreditBalance(this.credits - amount);
  }
}
