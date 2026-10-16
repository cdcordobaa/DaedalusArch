import { DomainError } from '../errors/DomainError';

const DAY_MS = 24 * 60 * 60 * 1000;

export class LoanPeriod {
  private constructor(readonly days: number) {}

  static ofDays(days: number): LoanPeriod {
    if (!Number.isInteger(days) || days < 1 || days > 60) {
      throw new DomainError('INVALID_LOAN_PERIOD', `Loan period must be 1 to 60 days: ${days}`);
    }
    return new LoanPeriod(days);
  }

  dueDateFrom(start: Date): Date {
    return new Date(start.getTime() + this.days * DAY_MS);
  }
}
