// Typings of the Giftjar gift voucher SDK (giftjar-sdk 1.9), as shipped by the vendor. Values are in cents.
declare module 'giftjar-sdk' {
  export type GiftjarVoucherStatus = 'issued' | 'activated' | 'partially_redeemed' | 'redeemed' | 'expired' | 'blocked';
  export type GiftjarRedemptionResult = 'accepted' | 'insufficient_balance' | 'voucher_blocked';
  export type GiftjarExtensionOutcome = 'extended' | 'not_allowed' | 'already_extended';
  export interface GiftjarVoucher {
    code: string;
    status: GiftjarVoucherStatus;
    balance_cents: number;
    currency: string;
    expires_on: string;
  }
  export interface GiftjarRedemption {
    id: string;
    code: string;
    result: GiftjarRedemptionResult;
    amount_cents: number;
    short_by_cents: number;
  }
  export interface GiftjarExtension {
    code: string;
    outcome: GiftjarExtensionOutcome;
    expires_on: string;
  }
  export class GiftjarClient {
    constructor(options: { merchantKey: string });
    lookup(code: string): Promise<GiftjarVoucher>;
    redeem(request: { code: string; amount_cents: number; reference: string }): Promise<GiftjarRedemption>;
    extend(code: string): Promise<GiftjarExtension>;
  }
}
