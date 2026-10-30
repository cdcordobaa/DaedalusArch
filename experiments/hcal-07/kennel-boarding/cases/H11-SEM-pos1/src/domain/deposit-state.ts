export type DepositState = 'HELD_ON_CARD' | 'TAKEN' | 'BOUNCED' | 'LET_GO' | 'PAID_BACK';
export type DepositAction = 'release' | 'refund' | 'none';
