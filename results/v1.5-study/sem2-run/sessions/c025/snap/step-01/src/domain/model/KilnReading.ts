/** How far a firing has come, in the studio's own terms. */
export type FiringProgress = 'waiting' | 'in_kiln' | 'complete' | 'faulted';

/** The newest reading of the kiln a piece is in, for the studio log. */
export interface KilnReading {
  readonly takenAt: string;
  readonly celsius: number;
  /** The kiln's own word for its phase, lower case, printed in the studio log as is. */
  readonly phaseCode: string;
  /** The studio's reading of that phase; decides the status a student sees. */
  readonly progress: FiringProgress;
}
