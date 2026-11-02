import type { Delivery } from '../model/Delivery';
import type { GeocodedAddress } from '../model/GeocodedAddress';

export const ADDRESS_NOT_FOUND = 'We could not find this address.';
const MIN_CONFIDENCE = 0.8;

/** Books a delivery only when the geocoded address is precise enough to drive to. */
export class DeliveryBooking {
  book(orderId: string, match: GeocodedAddress | null): Delivery {
    const drivable =
      match !== null &&
      (match.accuracy === 'building' || match.accuracy === 'street') &&
      match.confidence >= MIN_CONFIDENCE;
    if (!drivable) return { orderId, status: 'rejected', reason: ADDRESS_NOT_FOUND };
    return { orderId, status: 'scheduled', address: match.formatted, point: match.point };
  }
}
