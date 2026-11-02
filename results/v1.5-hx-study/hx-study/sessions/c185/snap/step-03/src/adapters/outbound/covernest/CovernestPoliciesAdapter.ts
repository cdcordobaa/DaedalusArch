import type { CovernestClient } from 'covernest-sdk';
import type { CoverPolicy, PolicyStatus } from '../../../domain/model/CoverPolicy';
import type { CoverPolicies } from '../../../application/ports/out/CoverPolicies';

export class CovernestPoliciesAdapter implements CoverPolicies {
  constructor(private readonly client: CovernestClient) {}

  async forQuote(quoteRef: string): Promise<CoverPolicy> {
    const p = await this.client.policyForQuote(quoteRef);
    return { policyNo: p.policyNo, quoteRef: p.quoteRef, status: statusOf(p.state), outstandingDocuments: [...p.missingDocs] };
  }
}

function statusOf(state: string): PolicyStatus {
  if (state === 'IN_FORCE') return 'in_force';
  if (state === 'PENDING_DOCS') return 'pending_docs';
  return 'voided';
}
