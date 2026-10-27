export interface ChargeReceipt {
  readonly id: string;
  readonly cents: number;
  readonly accepted: boolean;
}

export interface ChargeGateway {
  charge(payoutId: string, cents: number): ChargeReceipt;
}
