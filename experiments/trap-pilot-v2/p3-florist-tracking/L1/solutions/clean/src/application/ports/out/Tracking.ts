import type { DeliveryProgress } from '../../../domain/model/DeliveryProgress';

/** Where a sent bouquet is, in the application's own terms. */
export interface Tracking {
  progressOf(trackingCode: string): Promise<DeliveryProgress>;
}
