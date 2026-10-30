export type DepositOutcome = 'held' | 'refused';
export type RefusalReason = 'card-refused' | 'no-funds' | 'card-expired';

export interface PaymentRecord {
  readonly charge_id: string;
  readonly charge_status: string;
  readonly amount_authorised: number;
  readonly receipt_url: string | null;
}

export interface DepositHold {
  readonly depositRef: string;
  readonly outcome: DepositOutcome;
  readonly refusalReason: RefusalReason | null;
  readonly amountHeldCents: number;
  readonly record: PaymentRecord;
}
