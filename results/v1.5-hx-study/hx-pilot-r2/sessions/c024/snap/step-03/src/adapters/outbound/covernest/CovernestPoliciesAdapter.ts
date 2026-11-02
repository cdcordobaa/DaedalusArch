import type { CovernestClient } from 'covernest-sdk';
import type { CoverPolicies, CoverPolicy } from '../../../application/ports/out/CoverPolicies';

export class CovernestPoliciesAdapter implements CoverPolicies {
  constructor(private readonly client: CovernestClient) {}

  async forQuote(quoteRef: string): Promise<CoverPolicy> {
    const p = await this.client.policyForQuote(quoteRef);
    const state = p.state === 'IN_FORCE' ? 'in_force' : p.state === 'PENDING_DOCS' ? 'pending_docs' : 'voided';
    return { policyNo: p.policyNo, state, missingDocs: p.missingDocs };
  }
}
