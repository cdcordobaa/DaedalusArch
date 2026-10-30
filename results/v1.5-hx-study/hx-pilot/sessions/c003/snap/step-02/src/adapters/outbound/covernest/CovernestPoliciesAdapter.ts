import type { CovernestClient } from 'covernest-sdk';
import type { CoverPolicy } from '../../../domain/model/CoverPolicy';
import type { CoverPolicies } from '../../../application/ports/out/CoverPolicies';

export class CovernestPoliciesAdapter implements CoverPolicies {
  constructor(private readonly client: CovernestClient) {}

  async forQuote(quoteRef: string): Promise<CoverPolicy> {
    const p = await this.client.policyForQuote(quoteRef);
    return { policyNo: p.policyNo, quoteRef: p.quoteRef, insurerState: p.state, missingDocs: p.missingDocs };
  }
}
