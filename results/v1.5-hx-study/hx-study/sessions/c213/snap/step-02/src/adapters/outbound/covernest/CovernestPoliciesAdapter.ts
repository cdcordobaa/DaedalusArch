import type { CovernestClient } from 'covernest-sdk';
import type { CoverPolicy } from '../../../domain/model/CoverPolicy';
import type { CoverPolicies } from '../../../application/ports/out/CoverPolicies';

export class CovernestPoliciesAdapter implements CoverPolicies {
  constructor(private readonly client: CovernestClient) {}

  async forQuote(quoteRef: string): Promise<CoverPolicy> {
    const p = await this.client.policyForQuote(quoteRef);
    const standing = p.state === 'IN_FORCE' ? 'active' : p.state === 'PENDING_DOCS' ? 'awaiting_paperwork' : 'void';
    return { reference: p.policyNo, standing, outstandingPaperwork: [...p.missingDocs] };
  }
}
