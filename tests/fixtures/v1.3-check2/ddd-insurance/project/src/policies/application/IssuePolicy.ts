import { DomainError } from '../../shared-kernel/DomainError';
import { Policy } from '../domain/policy/Policy';
import { PolicyRepository } from '../domain/policy/PolicyRepository';

export interface CoverageRequest {
  peril: string;
  limitCents: number;
  deductibleCents: number;
}

export class IssuePolicy {
  private serial = 1000;

  constructor(private readonly policies: PolicyRepository) {}

  async issue(holder: string, startsOn: Date, months: number, coverages: CoverageRequest[]): Promise<string> {
    if (months < 1 || months > 36) {
      throw new DomainError('invalid', 'A policy runs between 1 and 36 months');
    }
    const endsOn = new Date(startsOn);
    endsOn.setMonth(endsOn.getMonth() + months);
    this.serial += 1;
    const policy = new Policy(`POL-${this.serial}`, holder, startsOn, endsOn);
    for (const c of coverages) policy.cover(c.peril, c.limitCents, c.deductibleCents);
    await this.policies.save(policy);
    return policy.number;
  }
}
