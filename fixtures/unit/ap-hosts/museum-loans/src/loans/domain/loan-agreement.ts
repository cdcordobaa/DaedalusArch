import { DateRange } from '../../shared/domain/date-range';
import { DomainError } from '../../shared/domain/domain-error';
import { InsuranceValuation } from './insurance-valuation';
import { LoanTooLongError, MAX_LOAN_DAYS } from './loan-terms';

export type LoanStatus = 'requested' | 'approved' | 'in-transit' | 'on-site' | 'returned' | 'declined';

export class LoanTransitionError extends DomainError {
  constructor(from: LoanStatus, to: LoanStatus) {
    super('LOAN_TRANSITION', `A loan cannot go from ${from} to ${to}`);
  }
}

const NEXT: Readonly<Record<LoanStatus, readonly LoanStatus[]>> = {
  requested: ['approved', 'declined'],
  approved: ['in-transit'],
  'in-transit': ['on-site', 'returned'],
  'on-site': ['returned'],
  returned: [],
  declined: [],
};

/** An inbound loan of one artwork from one lender. */
export class LoanAgreement {
  status: LoanStatus;

  constructor(
    readonly id: string,
    readonly artworkId: string,
    readonly lenderId: string,
    readonly period: DateRange,
    readonly valuation: InsuranceValuation,
    status: LoanStatus,
  ) {
    if (period.days() > MAX_LOAN_DAYS) {
      throw new LoanTooLongError(period.days());
    }
    this.status = status;
  }

  moveTo(next: LoanStatus): void {
    if (!NEXT[this.status].includes(next)) {
      throw new LoanTransitionError(this.status, next);
    }
    this.status = next;
  }
}
