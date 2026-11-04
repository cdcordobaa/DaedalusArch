import type { KilnReading } from '../../../../domain/model/KilnReading';
import type { PickupStatus } from '../../../../domain/model/PickupStatus';

/** How a scheduled firing is going, in the studio's own terms. */
export interface KilnReadings {
  newest(firingId: string): Promise<KilnReading>;
  /** The pickup status of pieces in the firing, from the kiln's newest phase. */
  pickupStatus(firingId: string): Promise<PickupStatus>;
}
