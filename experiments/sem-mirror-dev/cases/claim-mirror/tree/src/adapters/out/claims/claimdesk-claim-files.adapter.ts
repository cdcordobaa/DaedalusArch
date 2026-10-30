import { ClaimDeskClient, ClaimState } from 'claimdesk-sdk';
import { ClaimFilesPort } from '../../../application/ports/out/claim-files.port';
import { Claim, ClaimProgress } from '../../../domain/claim';

const PROGRESS: Record<ClaimState, ClaimProgress> = {
  CLM_OPEN: 'opened',
  CLM_ASSESS: 'assessing',
  CLM_APPROVED: 'approved',
  CLM_DENIED: 'denied',
  CLM_PAID: 'paid',
};

export class ClaimDeskClaimFilesAdapter implements ClaimFilesPort {
  private readonly client: ClaimDeskClient;

  constructor(token: string) {
    this.client = new ClaimDeskClient({ token });
  }

  async claim(ref: string): Promise<Claim> {
    const f = await this.client.file(ref);
    return { ref: f.claim_ref, progress: PROGRESS[f.state], amountCents: f.amount_cents };
  }
}
