import { ConditionReport } from './condition-report';
import { LoanTooLongError } from './errors';
import { DateRange } from './value-objects';

export class LoanPolicy {
  constructor(
    readonly maxLoanDays: number = 180,
    readonly blockedBorrowers: ReadonlySet<string> = new Set(['Shadow Gallery']),
  ) {}

  isBlocked(borrower: string): boolean {
    return this.blockedBorrowers.has(borrower);
  }

  isLendable(report: ConditionReport): boolean {
    return report.grade !== 'poor';
  }

  assertWithinDuration(period: DateRange): void {
    if (period.days() > this.maxLoanDays) throw new LoanTooLongError(this.maxLoanDays);
  }
}
