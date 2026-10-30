/** A household's yearly chimney sweeping plan; the fee is per sweep, in euros. */
export interface SweepPlan {
  readonly planId: string;
  readonly address: string;
  readonly flues: number;
  readonly sweepsPerYear: number;
  readonly fee: number;
  readonly mandateId: string;
  /** The bank's reference for the direct debit, printed on our letters. */
  readonly bankReference: string;
  readonly state: 'running' | 'stopped';
  /** The days of the sweeps done on this plan (YYYY-MM-DD). */
  readonly sweeps: readonly string[];
}
