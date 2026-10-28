/** What the application keeps of a deposit hold. */
export interface HoldReceipt {
  id: string;
  holdId: string;
  amountCents: number;
  currency: string;
}

export const HOLD_OUTCOMES = ['APPROVED', 'REJECTED'] as const;
