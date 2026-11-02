import type { CovernestClient } from 'covernest-sdk';
import type { CoverPolicies, CoverPolicy } from '../../../application/ports/out/CoverPolicies';

export class CovernestPoliciesAdapter implements CoverPolicies {
  constructor(private readonly client: CovernestClient) {}

  async forQuote(quoteRef: string): Promise<CoverPolicy> {
    const p = await this.client.policyForQuote(quoteRef);
    switch (p.state) {
      case 'IN_FORCE': return { state: 'in_force', policyNo: p.policyNo };
      case 'PENDING_DOCS': return { state: 'pending_docs', policyNo: p.policyNo, missingDocs: [...p.missingDocs] };
      default: return { state: 'voided', policyNo: p.policyNo };
    }
  }
}
