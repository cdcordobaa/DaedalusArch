import type { KilnReading } from '../../../../domain/model/KilnReading';

/** How a scheduled firing is going, in the studio's own terms. */
export interface KilnReadings {
  newest(firingId: string): Promise<KilnReading>;
}
