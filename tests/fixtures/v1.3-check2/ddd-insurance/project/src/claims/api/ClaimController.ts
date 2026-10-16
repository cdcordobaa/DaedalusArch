import { FileClaim } from '../application/FileClaim';
import { SettleClaim } from '../application/SettleClaim';

export interface FileClaimBody {
  policyNumber: string;
  peril: string;
  incidentOn: string;
  claimedCents: number;
}

export class ClaimController {
  constructor(
    private readonly fileClaim: FileClaim,
    private readonly settleClaim: SettleClaim,
  ) {}

  async file(body: FileClaimBody): Promise<{ claimId: string }> {
    const claimId = await this.fileClaim.file(body.policyNumber, body.peril, new Date(body.incidentOn), body.claimedCents);
    return { claimId };
  }

  async settle(claimId: string): Promise<{ paidCents: number }> {
    return { paidCents: await this.settleClaim.settle(claimId) };
  }
}
