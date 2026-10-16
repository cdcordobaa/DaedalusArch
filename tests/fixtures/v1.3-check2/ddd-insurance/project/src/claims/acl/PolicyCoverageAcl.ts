import { LookUpCoverage } from '../../policies';
import { CoverageSource, CoverageTerms } from '../application/ports/CoverageSource';

export class PolicyCoverageAcl implements CoverageSource {
  constructor(private readonly lookUp: LookUpCoverage) {}

  async termsFor(policyNumber: string, peril: string, on: Date): Promise<CoverageTerms | undefined> {
    const view = await this.lookUp.find(policyNumber, peril, on);
    return view === undefined ? undefined : { limitCents: view.limitCents, deductibleCents: view.deductibleCents };
  }
}
