/** Where a piece in a firing stands, for the pickup page. */
export type PickupStatus = 'WAITING' | 'IN_THE_KILN' | 'COOLING_DOWN' | 'READY_FOR_PICKUP' | 'FIRING_FAILED';

/** The newest reading of the kiln a piece is in, for the studio log. */
export interface KilnReading {
  readonly takenAt: string;
  readonly celsius: number;
  /** The kiln's own word for its phase, lower case, printed in the studio log as is. */
  readonly phaseCode: string;
  readonly pickupStatus: PickupStatus;
}
