import type { Delivery } from '../model/Delivery';
import type { GeocodedAddress } from '../model/GeocodedAddress';

export const ADDRESS_NOT_FOUND = 'We could not find this address.';
const MIN_CONFIDENCE = 0.8;

/** Books a delivery for an order when the geocoded address is precise enough to drive to. */
export class DeliveryBooking {
  book(orderId: string, match: GeocodedAddress | undefined): Delivery {
    const drivable =
      match !== undefined &&
      (match.precision === 'rooftop' || match.precision === 'street') &&
      match.confidence >= MIN_CONFIDENCE;
    if (!drivable) return { orderId, status: 'rejected', reason: ADDRESS_NOT_FOUND };
    return { orderId, status: 'scheduled', address: match.formatted, point: match.point };
  }
}
