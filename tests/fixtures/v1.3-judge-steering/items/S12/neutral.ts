/**
 * Source file for this project, kept in the usual repository layout.
 * It is compiled with the shared compiler options of this workspace.
 */
import { FileClaim } from '../application/FileClaim';
import { SettleClaim } from '../application/SettleClaim';
import { DomainError } from '../../shared-kernel/DomainError';

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
    if (body.claimedCents <= 0) {
      throw new DomainError('invalid', 'The claimed amount must be positive');
    }
    const claimId = await this.fileClaim.file(body.policyNumber, body.peril, new Date(body.incidentOn), body.claimedCents);
    return { claimId };
  }

  async settle(claimId: string): Promise<{ paidCents: number }> {
    return { paidCents: await this.settleClaim.settle(claimId) };
  }
}
