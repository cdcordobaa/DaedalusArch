import type { HoldState } from './HoldState';

/** A card payment as our receipts show it; amounts in euros. */
export interface PaymentRecord {
  readonly paymentId: string;
  readonly amount: number;
  /** The payment provider's own status text, printed on the receipt as is. */
  readonly providerStatus: string;
  readonly hold: HoldState;
}
