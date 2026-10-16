import { Loan } from '../entities/Loan';

export class FineCalculator {
  constructor(private readonly centsPerDay: number) {}

  fineInCents(loan: Loan, now: Date): number {
    return loan.daysOverdue(now) * this.centsPerDay;
  }
}
