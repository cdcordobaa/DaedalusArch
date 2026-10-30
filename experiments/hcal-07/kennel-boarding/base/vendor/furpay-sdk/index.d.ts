export type ChargeStatus = 'requires_capture' | 'captured' | 'declined' | 'released' | 'refunded';
export type DeclineCode = 'card_declined' | 'insufficient_funds' | 'expired_card' | 'do_not_honor';
export type FurPayErrorCode = 'rate_limited' | 'secret_key_invalid' | 'service_down';

export interface HoldRequest {
  customer_ref: string;
  amount_minor: number;
  currency_iso: string;
  statement_descriptor: string;
}

export interface ChargeResponse {
  charge_id: string;
  charge_status: ChargeStatus;
  amount_authorised: number;
  decline_code: DeclineCode | null;
  receipt_url: string | null;
  created_at: string;
}

export class FurPayDecline extends Error {
  decline_code: DeclineCode;
}

export class FurPayApiError extends Error {
  code: FurPayErrorCode;
}

export class FurPayClient {
  constructor(options: { secret_key: string });
  hold(request: HoldRequest): Promise<ChargeResponse>;
  capture(charge_id: string): Promise<ChargeResponse>;
  release(charge_id: string): Promise<ChargeResponse>;
}
