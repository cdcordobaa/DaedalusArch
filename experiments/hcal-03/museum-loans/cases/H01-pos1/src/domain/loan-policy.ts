import { Clock } from '../application/ports/out/clock.port';
import { ConditionReport } from './condition-report';
import { LoanTooLongError } from './errors';
import { LoanRequest } from './loan-request';
import { DateRange } from './value-objects';

export class LoanPolicy {
  constructor(readonly maxLoanDays: number = 180) {}

  isLendable(report: ConditionReport): boolean {
    return report.grade !== 'poor';
  }

  assertWithinDuration(period: DateRange): void {
    if (period.days() > this.maxLoanDays) throw new LoanTooLongError(this.maxLoanDays);
  }

  isExpired(loan: LoanRequest, clock: Clock): boolean {
    return clock.now().getTime() > loan.period.end.getTime();
  }
}
