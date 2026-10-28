import type { ClaimResult } from '../out/claims-gateway.port';

export interface SubmitClaimCommand {
  invoiceId: string;
  policyNumber: string;
}

export interface SubmitClaimPort {
  execute(command: SubmitClaimCommand): Promise<ClaimResult>;
}
