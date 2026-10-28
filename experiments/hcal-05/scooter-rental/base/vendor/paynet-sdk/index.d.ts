export type PaynetStatus =
  | 'AUTHORIZED'
  | 'DECLINED_INSUFFICIENT_FUNDS'
  | 'DECLINED_CARD_EXPIRED'
  | 'DECLINED_SUSPECTED_FRAUD'
  | 'PENDING_REVIEW';
export type PaynetPrecision = 'MINOR_UNITS' | 'WHOLE_UNITS';
export type PaynetErrorCode = 'ERR_NETWORK_TIMEOUT' | 'ERR_INVALID_MERCHANT' | 'ERR_RATE_LIMITED';
export interface PaynetChargeRequest {
  amount_minor: number;
  currency_code: string;
  card_token: string;
  merchant_ref: string;
  precision: PaynetPrecision;
}
export interface PaynetChargeResponse {
  status: PaynetStatus;
  txn_id: string;
  auth_code?: string;
}
export class PaynetError extends Error {
  code: PaynetErrorCode;
  constructor(code: PaynetErrorCode, message: string);
}
export class PaynetClient {
  constructor(options: { apiKey: string });
  charge(request: PaynetChargeRequest): Promise<PaynetChargeResponse>;
}
