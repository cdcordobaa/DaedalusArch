import type { CovernestClient } from 'covernest-sdk';
import { HireError } from '../../../domain/errors/HireError';
import type { CoverPolicy } from '../../../domain/model/CoverPolicy';
import type { CoverPolicies } from '../../../application/ports/out/CoverPolicies';

export class CovernestPoliciesAdapter implements CoverPolicies {
  constructor(private readonly client: CovernestClient) {}

  async forQuote(quoteRef: string): Promise<CoverPolicy> {
    const p = await this.client.policyForQuote(quoteRef);
    if (p.state === 'VOIDED') throw new HireError('there is no valid cover for this hire');
    return { policyNo: p.policyNo, quoteRef: p.quoteRef, outstandingPaperwork: p.state === 'PENDING_DOCS' ? [...p.missingDocs] : [] };
  }
}
