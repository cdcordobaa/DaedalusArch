import type { ParcelStage } from '../../../domain/model/ParcelStage';

/** Where a sent bouquet is, in the application's own terms. */
export interface Tracking {
  stageOf(trackingCode: string): Promise<ParcelStage>;
}
