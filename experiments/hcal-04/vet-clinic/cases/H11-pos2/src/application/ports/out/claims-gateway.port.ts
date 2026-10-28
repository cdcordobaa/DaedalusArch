import type { ClaimOutcome, RejectionReason } from '../../../domain/claim-outcome';

export enum TreatmentPrecision {
  EXACT = 'EXACT',
  APPROXIMATE = 'APPROXIMATE',
  UNKNOWN = 'UNKNOWN',
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
  precision?: TreatmentPrecision;
}

export interface ClaimsGatewayPort {
  submit(request: ClaimRequestData): Promise<ClaimResult>;
}
