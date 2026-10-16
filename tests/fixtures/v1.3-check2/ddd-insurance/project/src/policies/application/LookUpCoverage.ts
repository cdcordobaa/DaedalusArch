import { CoverageView } from '../contracts/CoverageView';
import { PolicyRepository } from '../domain/policy/PolicyRepository';

export class LookUpCoverage {
  constructor(private readonly policies: PolicyRepository) {}

  async find(policyNumber: string, peril: string, on: Date): Promise<CoverageView | undefined> {
    const policy = await this.policies.byNumber(policyNumber);
    const coverage = policy?.coverageFor(peril, on);
    return coverage === undefined ? undefined : { policyNumber, peril, limitCents: coverage.limitCents, deductibleCents: coverage.deductibleCents };
  }
}
