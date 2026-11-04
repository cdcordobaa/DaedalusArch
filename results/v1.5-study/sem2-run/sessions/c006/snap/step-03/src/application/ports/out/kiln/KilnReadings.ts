import type { FiringProgress } from '../../../../domain/model/FiringProgress';
import type { KilnReading } from '../../../../domain/model/KilnReading';

/** How a scheduled firing is going, in the studio's own terms. */
export interface KilnReadings {
  newest(firingId: string): Promise<KilnReading>;
  /** Where the firing stands, decided by the kiln's newest phase. */
  progress(firingId: string): Promise<FiringProgress>;
}
