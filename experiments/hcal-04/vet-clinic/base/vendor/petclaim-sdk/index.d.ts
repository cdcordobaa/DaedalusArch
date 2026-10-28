export type ClaimStatus = 'APPROVED' | 'DENIED' | 'PENDING_REVIEW';
export type DeclineCode = 'POLICY_LAPSED' | 'LIMIT_EXCEEDED' | 'PRE_EXISTING';
export type TreatmentPrecision = 'EXACT' | 'APPROXIMATE' | 'UNKNOWN';
export type PetClaimErrorCode = 'RATE_LIMITED' | 'UNAVAILABLE';

export interface ClaimRequest {
  policy_no: string;
  claim_amount_cents: number;
  treatment_code: string;
}

export interface ClaimResponse {
  claim_ref: string;
  claim_status: ClaimStatus;
  decline_code?: DeclineCode;
  precision: TreatmentPrecision;
}

export class PetClaimError extends Error {
  code: PetClaimErrorCode;
  constructor(code: PetClaimErrorCode, message: string);
}

export class PetClaimClient {
  constructor(options: { apiKey: string });
  submitClaim(request: ClaimRequest): Promise<ClaimResponse>;
}
