// Typings of a card-hold vendor SDK, as the vendor ships them.
declare module 'coinvault-sdk' {
  export interface CoinvaultHoldRequest {
    customerRef: string;
    amountCents: number;
    currency: string;
  }
  export interface CoinvaultHold {
    holdId: string;
    outcome: 'APPROVED' | 'REJECTED' | 'REVIEW';
    rejectReason?: 'limit_exceeded' | 'card_blocked' | 'fraud_suspected';
    amountCents: number;
    currency: string;
  }
  export class CoinvaultClient {
    constructor(options: { apiKey: string });
    hold(request: CoinvaultHoldRequest): Promise<CoinvaultHold>;
  }
}
