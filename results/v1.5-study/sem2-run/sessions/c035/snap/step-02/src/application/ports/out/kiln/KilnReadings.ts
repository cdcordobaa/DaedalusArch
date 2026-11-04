import type { KilnReading } from '../../../../domain/model/KilnReading';
import type { PieceStatus } from '../../../../domain/model/PieceStatus';

/** How a scheduled firing is going, in the studio's own terms. */
export interface KilnReadings {
  newest(firingId: string): Promise<KilnReading>;
  /** The pickup status of the pieces in a firing, decided by the kiln's newest phase. */
  statusOf(firingId: string): Promise<PieceStatus>;
}
