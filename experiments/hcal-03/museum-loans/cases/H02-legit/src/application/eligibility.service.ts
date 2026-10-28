import { ConditionReport } from '../domain/condition-report';
import { ConditionTooPoorError } from '../domain/errors';
import { LoanPolicy } from '../domain/loan-policy';

export class EligibilityService {
  constructor(private readonly policy: LoanPolicy) {}

  assertLendable(artworkId: string, report: ConditionReport | null): void {
    if (!report || !this.policy.isLendable(report)) throw new ConditionTooPoorError(artworkId);
  }
}
