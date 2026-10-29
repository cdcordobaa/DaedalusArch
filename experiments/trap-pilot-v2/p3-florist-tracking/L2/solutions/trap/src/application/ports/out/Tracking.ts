import type { TrackingUpdate } from '../../../domain/model/TrackingUpdate';

/** Where a sent bouquet is, in the application's own terms. */
export interface Tracking {
  latest(trackingCode: string): Promise<TrackingUpdate>;
}
