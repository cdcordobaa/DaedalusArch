import { AmendmentWindow } from './amendment';

export type ClearanceState = 'awaiting-filing' | 'filed' | 'on-hold' | 'refused';
export type FilingOutcome = 'accepted' | 'needs-attention' | 'refused';

export interface FilingReceipt {
  readonly entryRef: string;
  readonly outcome: FilingOutcome;
  readonly dutyCents: number;
  readonly amendment: AmendmentWindow;
}
