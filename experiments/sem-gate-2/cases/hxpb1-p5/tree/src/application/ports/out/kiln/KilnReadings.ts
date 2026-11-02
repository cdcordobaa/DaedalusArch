import type { KilnReading } from '../../../../domain/model/KilnReading';

/** How a scheduled firing is going, in the studio's own terms. */
export interface KilnReadings {
  newest(firingId: string): Promise<KilnReading>;
  /** The kiln's own word for the phase of a firing. */
  phaseOf(firingId: string): Promise<string>;
}
