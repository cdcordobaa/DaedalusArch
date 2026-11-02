import type { AddressMatch } from '../model/AddressMatch';
import type { Delivery } from '../model/Delivery';

export const ADDRESS_NOT_FOUND = 'We could not find this address.';
const MIN_CONFIDENCE = 0.8;

/** Books a delivery for an order when the best match is precise enough to drive to. */
export class DeliveryBooking {
  book(orderId: string, match: AddressMatch | undefined): Delivery {
    const drivable = match !== undefined
      && (match.accuracy === 'building' || match.accuracy === 'street')
      && match.confidence >= MIN_CONFIDENCE;
    if (!drivable) return { orderId, status: 'rejected', reason: ADDRESS_NOT_FOUND };
    return { orderId, status: 'scheduled', address: match.address, point: match.point };
  }
}
