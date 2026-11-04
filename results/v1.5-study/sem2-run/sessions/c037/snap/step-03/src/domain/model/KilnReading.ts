/** The phase of a firing, as the studio understands it. */
export type KilnPhase = 'SCHEDULED' | 'CANDLING' | 'RAMPING' | 'HOLDING' | 'COOLING' | 'COMPLETE' | 'FAULTED';

/** What a student sees on the pickup page. */
export type PickupStatus = 'DROPPED_OFF' | 'WAITING' | 'IN_THE_KILN' | 'COOLING_DOWN' | 'READY_FOR_PICKUP' | 'FIRING_FAILED';

/** The newest reading of the kiln a piece is in, for the studio log. */
export interface KilnReading {
  readonly takenAt: string;
  readonly celsius: number;
  /** The kiln's own word for its phase, lower case, printed in the studio log as is. */
  readonly phaseCode: string;
  readonly phase: KilnPhase;
}

export function pickupStatusOf(phase: KilnPhase): PickupStatus {
  switch (phase) {
    case 'SCHEDULED':
    case 'CANDLING':
      return 'WAITING';
    case 'RAMPING':
    case 'HOLDING':
      return 'IN_THE_KILN';
    case 'COOLING':
      return 'COOLING_DOWN';
    case 'COMPLETE':
      return 'READY_FOR_PICKUP';
    case 'FAULTED':
      return 'FIRING_FAILED';
  }
}
