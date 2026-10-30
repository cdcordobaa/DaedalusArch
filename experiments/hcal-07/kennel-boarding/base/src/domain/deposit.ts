export type DepositOutcome = 'held' | 'refused';
export type RefusalReason = 'card-refused' | 'no-funds' | 'card-expired';

export interface DepositHold {
  readonly depositRef: string;
  readonly outcome: DepositOutcome;
  readonly refusalReason: RefusalReason | null;
  readonly amountHeldCents: number;
}
