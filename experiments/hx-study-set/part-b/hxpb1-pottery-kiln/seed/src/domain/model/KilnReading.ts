/** The newest reading of the kiln a piece is in, for the studio log. */
export interface KilnReading {
  readonly takenAt: string;
  readonly celsius: number;
  /** The kiln's own word for its phase, lower case, printed in the studio log as is. */
  readonly phaseCode: string;
}
