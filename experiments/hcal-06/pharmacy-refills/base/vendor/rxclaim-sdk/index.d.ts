export type ClaimStatus = 'PAID' | 'CAPTURED' | 'PENDING_PA' | 'REJECTED' | 'REVERSED';
export type RejectCode = 'R70' | 'R75' | 'R76' | 'R79' | 'R88';
export type SwitchRoute = 'ROUTE_DIRECT' | 'ROUTE_CLEARINGHOUSE' | 'ROUTE_BATCH';
export type CopayBasis = 'FLAT' | 'COINSURANCE';
export type FaultCode = 'PAYER_TIMEOUT' | 'BIN_UNKNOWN' | 'SWITCH_DOWN';

export interface ClaimSubmission {
  member_id: string;
  bin_number: string;
  ndc_code: string;
  quantity_dispensed: number;
  days_supply?: number;
}

export interface ClaimResponse {
  claim_ref: string;
  claim_status: ClaimStatus;
  reject_codes: RejectCode[];
  patient_pay_amount: number;
  plan_pay_amount: number;
  copay_basis: CopayBasis;
  route: SwitchRoute;
  adjudicated_at: string;
}

export class AdjudicationFault extends Error {
  fault_code: FaultCode;
}

export class RxClaimClient {
  constructor(options: { api_key: string });
  adjudicate(submission: ClaimSubmission): Promise<ClaimResponse>;
}
