/** Where a firing stands, in the studio's own terms. */
export type KilnStage = 'queued' | 'heating' | 'cooling' | 'finished' | 'failed';

/** The newest reading of the kiln a piece is in, for the studio log. */
export interface KilnReading {
  readonly takenAt: string;
  readonly celsius: number;
  readonly stage: KilnStage;
  /** The kiln's own word for its phase, lower case, printed in the studio log as is. */
  readonly phaseCode: string;
}
