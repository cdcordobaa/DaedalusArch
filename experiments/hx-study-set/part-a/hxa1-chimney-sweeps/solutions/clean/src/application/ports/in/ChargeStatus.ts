/** Where a direct debit charge stands, in our own words. */
export type ChargeOutcome = 'collected' | 'on_its_way' | 'bounced';

export interface ChargeView {
  readonly paymentId: string;
  readonly outcome: ChargeOutcome;
}

export interface ChargeStatus {
  status(paymentId: string): Promise<ChargeView>;
}
