import type { Delivery } from '../model/Delivery';
import type { VerifiedAddress } from '../model/VerifiedAddress';

export const MIN_CONFIDENCE = 0.8;
export const ADDRESS_NOT_FOUND = 'We could not find this address.';

/** Books a delivery for an order when the verified address is precise enough to drive to. */
export class DeliveryBooking {
  book(orderId: string, verified: VerifiedAddress | undefined): Delivery {
    const drivable =
      verified !== undefined &&
      (verified.precision === 'rooftop' || verified.precision === 'street') &&
      verified.confidence >= MIN_CONFIDENCE;
    if (!drivable) return { orderId, status: 'rejected', reason: ADDRESS_NOT_FOUND };
    return { orderId, status: 'scheduled', address: verified.formatted, point: verified.point };
  }
}
