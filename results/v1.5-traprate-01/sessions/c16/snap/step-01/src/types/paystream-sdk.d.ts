// Typings of the Paystream payments SDK (paystream-sdk 5.1), as shipped by the vendor.
declare module 'paystream-sdk' {
  export interface PaystreamCardSource {
    token: string;
    holderName?: string;
  }
  export interface PaystreamChargeRequest {
    amountMinor: number;
    currency: string;
    source: PaystreamCardSource;
    captureMethod: 'automatic' | 'manual';
    merchantReference?: string;
  }
  export interface PaystreamCharge {
    chargeId: string;
    state: 'SUCCEEDED' | 'DECLINED';
    amountMinor: number;
    currency: string;
    declineCode?: 'insufficient_funds' | 'expired_card' | 'do_not_honor' | 'lost_card';
  }
  export interface PaystreamRefundRequest {
    chargeId: string;
    amountMinor: number;
    currency: string;
  }
  export interface PaystreamRefund {
    refundId: string;
    state: 'SUCCEEDED' | 'QUEUED';
  }
  export class PaystreamUnavailableError extends Error {}
  export class PaystreamClient {
    constructor(options: { apiKey: string });
    charge(request: PaystreamChargeRequest): Promise<PaystreamCharge>;
    refund(request: PaystreamRefundRequest): Promise<PaystreamRefund>;
  }
}
