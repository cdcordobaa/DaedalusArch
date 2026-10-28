import type { ClaimOutcome, RejectionReason } from '../../../domain/claim-outcome';

export interface ClaimRequestData {
  policyNumber: string;
  amountCents: number;
  treatmentCode: string;
}

export interface ClaimResult {
  reference: string;
  outcome: ClaimOutcome;
  reason?: RejectionReason;
}

export interface ClaimsGatewayPort {
  submit(request: ClaimRequestData): Promise<ClaimResult>;
}
