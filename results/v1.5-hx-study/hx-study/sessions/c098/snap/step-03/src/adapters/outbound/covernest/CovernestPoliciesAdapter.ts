import type { CovernestClient } from 'covernest-sdk';
import type { CoverPolicy } from '../../../domain/model/CoverPolicy';
import type { CoverPolicies } from '../../../application/ports/out/CoverPolicies';

export class CovernestPoliciesAdapter implements CoverPolicies {
  constructor(private readonly client: CovernestClient) {}

  async forQuote(quoteRef: string): Promise<CoverPolicy> {
    const p = await this.client.policyForQuote(quoteRef);
    return {
      policyNo: p.policyNo,
      status: p.state === 'IN_FORCE' ? 'in_force' : p.state === 'PENDING_DOCS' ? 'awaiting_documents' : 'void',
      missingDocuments: p.missingDocs,
    };
  }
}
