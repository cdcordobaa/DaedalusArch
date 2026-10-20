// Typings of the Paystream Node SDK (package @paystream/node), vendored with the project.
declare module '@paystream/node' {
  export interface PaystreamOptions {
    apiKey: string;
    timeoutMs?: number;
  }
  export interface Charge {
    id: string;
    status: 'succeeded' | 'declined';
    amountMinor: number;
    currency: string;
    declineCode?: 'insufficient_funds' | 'card_expired' | 'suspected_fraud' | 'limit_exceeded';
  }
  export interface Refund {
    id: string;
    chargeId: string;
    status: 'pending' | 'succeeded' | 'failed';
  }
  export class PaystreamError extends Error {
    readonly code: string;
    readonly retryable: boolean;
  }
  export class Paystream {
    constructor(options: PaystreamOptions);
    charges: {
      create(params: { amountMinor: number; currency: string; customerRef: string; idempotencyKey: string }): Promise<Charge>;
      retrieve(chargeId: string): Promise<Charge>;
    };
    refunds: {
      create(params: { chargeId: string; idempotencyKey: string }): Promise<Refund>;
    };
  }
}
