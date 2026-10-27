import type { PositionFix } from '../../../domain/whereabouts';

export interface RiderPositions {
  /** The latest position reported by a tracker, or null when none is known. */
  latestFix(trackerId: string): Promise<PositionFix | null>;
}
