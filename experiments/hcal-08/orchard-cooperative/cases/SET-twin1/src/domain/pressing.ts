export type LotUse = 'table' | 'press' | 'compost';
export type PressingProgress = 'waiting' | 'in-progress' | 'finished' | 'failed';

export interface PressingTicket {
  readonly runRef: string;
  readonly accepted: boolean;
  readonly use: LotUse;
}
