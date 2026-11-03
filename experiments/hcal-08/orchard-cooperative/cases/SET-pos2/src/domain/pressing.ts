export type PressingProgress = 'waiting' | 'in-progress' | 'finished' | 'failed';

export interface PressingTicket {
  readonly runRef: string;
  readonly accepted: boolean;
  readonly grade: string;
}
