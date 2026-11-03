import type { CovernestClient } from 'covernest-sdk';
import type { PolicyCheck } from '../../../domain/model/PolicyCheck';
import type { Policies } from '../../../application/ports/out/Policies';

export class CovernestPoliciesAdapter implements Policies {
  constructor(private readonly client: CovernestClient) {}

  async forQuote(quoteRef: string): Promise<PolicyCheck> {
    const p = await this.client.policyForQuote(quoteRef);
    return { policyNo: p.policyNo, ready: p.state === 'IN_FORCE', missing: p.missingDocs };
  }
}
