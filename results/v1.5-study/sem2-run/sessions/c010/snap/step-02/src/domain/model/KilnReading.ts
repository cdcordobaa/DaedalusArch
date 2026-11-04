/** The kiln's phases as the studio understands them. */
export type KilnPhase = 'SCHEDULED' | 'CANDLING' | 'RAMPING' | 'HOLDING' | 'COOLING' | 'COMPLETE' | 'FAULTED';

/** The newest reading of the kiln a piece is in, for the studio log. */
export interface KilnReading {
  readonly takenAt: string;
  readonly celsius: number;
  /** The kiln's own word for its phase, lower case, printed in the studio log as is. */
  readonly phaseCode: string;
  /** The kiln's phase, as reported. */
  readonly phase: KilnPhase;
}
