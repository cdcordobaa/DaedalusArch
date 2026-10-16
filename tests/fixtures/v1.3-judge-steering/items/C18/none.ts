import { DomainError } from '../../shared-kernel/DomainError';
import { Money } from '../../shared-kernel/Money';
import { ClaimRepository } from '../domain/claim/ClaimRepository';
import { CoverageSource } from './ports/CoverageSource';

export class SettleClaim {
  constructor(
    private readonly claims: ClaimRepository,
    private readonly coverage: CoverageSource,
  ) {}

  async settle(claimId: string): Promise<number> {
    const claim = await this.claims.byId(claimId);
    if (claim === undefined) throw new DomainError('not-found', `No claim ${claimId}`);
    const terms = await this.coverage.termsFor(claim.policyNumber, claim.peril, claim.incidentOn);
    if (terms === undefined) {
      claim.decline();
      await this.claims.save(claim);
      return 0;
    }
    const paid = claim.settle(new Money(terms.limitCents), new Money(terms.deductibleCents));
    await this.claims.save(claim);
    return paid.cents;
  }
}
