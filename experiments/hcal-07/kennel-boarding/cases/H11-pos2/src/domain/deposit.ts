export type DepositOutcome = 'held' | 'refused';
export type RefusalReason = 'card-refused' | 'no-funds' | 'card-expired';

export interface DepositHold {
  readonly depositRef: string;
  readonly outcome: DepositOutcome;
  readonly refusalReason: RefusalReason | null;
  readonly amountHeldCents: number;
}

export const REASON_BY_DECLINE: Record<string, RefusalReason> = {
  card_declined: 'card-refused',
  insufficient_funds: 'no-funds',
  expired_card: 'card-expired',
  do_not_honor: 'card-refused',
};
