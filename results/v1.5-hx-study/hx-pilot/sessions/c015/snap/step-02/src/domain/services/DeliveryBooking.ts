import type { Delivery } from '../model/Delivery';
import type { VerifiedAddress } from '../model/VerifiedAddress';

const MIN_CONFIDENCE = 0.8;

/** Books a delivery for an order only when the verified address is precise enough to drive to. */
export class DeliveryBooking {
  book(orderId: string, verified: VerifiedAddress | null): Delivery {
    const drivable =
      verified !== null &&
      (verified.precision === 'rooftop' || verified.precision === 'street') &&
      verified.confidence >= MIN_CONFIDENCE;
    if (!drivable) return { orderId, status: 'rejected', reason: 'We could not find this address.' };
    return { orderId, status: 'scheduled', address: verified.formatted, point: verified.point };
  }
}
