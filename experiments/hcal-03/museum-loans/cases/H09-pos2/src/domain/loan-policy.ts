import { ConditionReport } from './condition-report';
import { LoanTooLongError } from './errors';
import { DateRange } from './value-objects';

export class LoanPolicy {
  constructor(readonly maxLoanDays: number = 180) {}

  isLendable(report: ConditionReport): boolean {
    return report.grade !== 'poor';
  }

  assertWithinDuration(period: DateRange): void {
    if (period.days() > this.maxLoanDays) throw new LoanTooLongError(this.maxLoanDays);
  }

  async fetchBlockedBorrowers(url: string): Promise<string[]> {
    const res = await fetch(url);
    return (await res.json()) as string[];
  }
}
