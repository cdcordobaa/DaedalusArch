import type { Delivery } from '../model/Delivery';
import type { VerifiedAddress } from '../model/VerifiedAddress';

const MIN_CONFIDENCE = 0.8;

/** Books a delivery for an order only when the verified address is precise enough to drive to. */
export class DeliveryBooking {
  book(orderId: string, verified: VerifiedAddress | null, country: string): Delivery {
    if (verified !== null && verified.country !== country) {
      return { orderId, status: 'rejected', reason: 'This address is in another country.' };
    }
    if (verified === null || verified.confidence < MIN_CONFIDENCE) {
      return { orderId, status: 'rejected', reason: 'We could not find this address.' };
    }
    if (verified.precision === 'coarse') {
      return { orderId, status: 'rejected', reason: 'Please add your street and house number.' };
    }
    return { orderId, status: 'scheduled', address: verified.formatted, point: verified.point };
  }
}
