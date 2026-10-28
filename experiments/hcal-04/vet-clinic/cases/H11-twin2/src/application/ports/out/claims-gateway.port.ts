import type { ClaimOutcome, RejectionReason } from '../../../domain/claim-outcome';

export enum ReviewPrecision {
  Confirmed = 'confirmed',
  Estimated = 'estimated',
  Undetermined = 'undetermined',
}

export interface ClaimRequestData {
  policyNumber: string;
  amountCents: number;
  treatmentCode: string;
}

export interface ClaimResult {
  reference: string;
  outcome: ClaimOutcome;
  reason?: RejectionReason;
  precision?: ReviewPrecision;
}

export interface ClaimsGatewayPort {
  submit(request: ClaimRequestData): Promise<ClaimResult>;
}
