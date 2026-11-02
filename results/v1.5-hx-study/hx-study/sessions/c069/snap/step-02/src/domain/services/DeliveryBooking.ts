import type { Delivery } from '../model/Delivery';
import type { GeocodedAddress } from '../model/GeocodedAddress';

export const ADDRESS_NOT_FOUND = 'We could not find this address.';
const MIN_CONFIDENCE = 0.8;

/** Books a delivery for an order when the address was located precisely enough to drive to. */
export class DeliveryBooking {
  book(orderId: string, match: GeocodedAddress | undefined): Delivery {
    if (!match || match.accuracy === 'area' || match.confidence < MIN_CONFIDENCE) {
      return { orderId, status: 'rejected', reason: ADDRESS_NOT_FOUND };
    }
    return { orderId, status: 'scheduled', address: match.canonicalAddress, point: match.point };
  }
}
