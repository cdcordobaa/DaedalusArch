/** The phases the kiln controller reports. */
export type KilnPhase = 'SCHEDULED' | 'CANDLING' | 'RAMPING' | 'HOLDING' | 'COOLING' | 'COMPLETE' | 'FAULTED';

/** The newest reading of the kiln a piece is in, for the studio log. */
export interface KilnReading {
  readonly takenAt: string;
  readonly celsius: number;
  /** The kiln's own word for its phase, lower case, printed in the studio log as is. */
  readonly phaseCode: string;
  /** The phase as reported, used to derive the pickup status. */
  readonly phase: KilnPhase;
}
