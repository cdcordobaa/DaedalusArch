import type { PlayerRecord } from './PlayerRecord';

export type Section = 'open' | 'amateur';

/** A player's place in one section of the weekend congress. */
export interface Entry extends PlayerRecord {
  readonly entryNo: number;
  readonly section: Section;
  /** Euros. */
  readonly feeEuros: number;
}
