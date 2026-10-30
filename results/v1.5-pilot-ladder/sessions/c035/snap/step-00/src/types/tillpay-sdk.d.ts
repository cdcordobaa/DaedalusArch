// Typings of the Tillpay card payments SDK (tillpay-sdk 7.1), as shipped by the vendor. Amounts are in minor units.
declare module 'tillpay-sdk' {
  export type TillpayIntentStatus = 'requires_payment_method' | 'requires_action' | 'requires_capture' | 'processing' | 'succeeded' | 'canceled';
  export interface TillpayIntent {
    id: string;
    status: TillpayIntentStatus;
    amount: number;
    currency: string;
    amount_received: number;
  }
  export interface TillpayRefund {
    id: string;
    intent: string;
    amount: number;
    state: 'pending' | 'done' | 'failed';
  }
  export class TillpayError extends Error {
    readonly kind: 'card_error' | 'api_error';
  }
  export class TillpayClient {
    constructor(options: { apiKey: string });
    retrieveIntent(id: string): Promise<TillpayIntent>;
    captureIntent(id: string): Promise<TillpayIntent>;
    cancelIntent(id: string): Promise<TillpayIntent>;
    refund(request: { intent: string; amount: number }): Promise<TillpayRefund>;
  }
}
