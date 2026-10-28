import type { Delivery } from '../model/Delivery';
import type { GeocodedAddress } from '../model/GeocodedAddress';

const MIN_CONFIDENCE = 0.8;

/** Books a delivery for an order when the geocoded match is precise enough to drive to. */
export class DeliveryBooking {
  book(orderId: string, match: GeocodedAddress | undefined): Delivery {
    if (
      !match
      || (match.precision !== 'ROOFTOP' && match.precision !== 'STREET')
      || match.confidence < MIN_CONFIDENCE
    ) {
      return { orderId, status: 'rejected', reason: 'We could not find this address.' };
    }
    return { orderId, status: 'scheduled', address: match.address, point: match.point };
  }
}
