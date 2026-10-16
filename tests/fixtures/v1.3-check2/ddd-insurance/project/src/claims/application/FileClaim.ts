import { DomainError } from '../../shared-kernel/DomainError';
import { Claim } from '../domain/claim/Claim';
import { ClaimRepository } from '../domain/claim/ClaimRepository';
import { CoverageSource } from './ports/CoverageSource';

export class FileClaim {
  private next = 1;

  constructor(
    private readonly claims: ClaimRepository,
    private readonly coverage: CoverageSource,
  ) {}

  async file(policyNumber: string, peril: string, incidentOn: Date, claimedCents: number): Promise<string> {
    if (claimedCents <= 0) {
      throw new DomainError('invalid', 'The claimed amount must be positive');
    }
    if ((await this.coverage.termsFor(policyNumber, peril, incidentOn)) === undefined) {
      throw new DomainError('rejected', `${policyNumber} does not cover ${peril} on that date`);
    }
    const claim = new Claim(`CLM-${this.next++}`, policyNumber, peril, incidentOn, claimedCents);
    await this.claims.save(claim);
    return claim.id;
  }
}
