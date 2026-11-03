/** What a student sees about a piece that is in a firing. */
export type PickupStatus = 'WAITING' | 'IN_THE_KILN' | 'READY_FOR_PICKUP' | 'FIRING_FAILED';

/** The newest reading of the kiln a piece is in, for the studio log. */
export interface KilnReading {
  readonly takenAt: string;
  readonly celsius: number;
  /** The kiln's own word for its phase, lower case, printed in the studio log as is. */
  readonly phaseCode: string;
  /** The pickup status the kiln's phase stands for. */
  readonly pickup: PickupStatus;
}
