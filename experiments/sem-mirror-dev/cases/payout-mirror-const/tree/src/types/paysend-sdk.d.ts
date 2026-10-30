declare module 'paysend-sdk' {
  /** PaySend payout lifecycle. PO_HELD_COMPLIANCE: held by PaySend's compliance review (KYC). */
  export type PayoutStatus = 'PO_QUEUED' | 'PO_SENT' | 'PO_BOUNCED' | 'PO_HELD_COMPLIANCE';

  export interface Payout {
    payout_id: string;
    status: PayoutStatus;
  }

  export class PaySendClient {
    constructor(options: { secret: string });
    payout(id: string): Promise<Payout>;
  }
}
