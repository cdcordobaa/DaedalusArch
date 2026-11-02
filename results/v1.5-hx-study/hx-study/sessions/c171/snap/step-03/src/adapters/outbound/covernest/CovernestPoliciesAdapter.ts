import type { CovernestClient } from 'covernest-sdk';
import type { CoverPolicies, PolicyCover } from '../../../application/ports/out/CoverPolicies';

export class CovernestPoliciesAdapter implements CoverPolicies {
  constructor(private readonly client: CovernestClient) {}

  async forQuote(quoteRef: string): Promise<PolicyCover> {
    const p = await this.client.policyForQuote(quoteRef);
    switch (p.state) {
      case 'IN_FORCE': return { kind: 'in_force', policyNo: p.policyNo };
      case 'PENDING_DOCS': return { kind: 'documents_missing', policyNo: p.policyNo, missing: [...p.missingDocs] };
      default: return { kind: 'void', policyNo: p.policyNo };
    }
  }
}
