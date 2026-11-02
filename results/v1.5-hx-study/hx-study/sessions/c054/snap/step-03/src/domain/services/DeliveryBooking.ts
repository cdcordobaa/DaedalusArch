import type { Delivery } from '../model/Delivery';
import type { VerifiedAddress } from '../model/VerifiedAddress';

export const MIN_CONFIDENCE = 0.8;
export const ADDRESS_NOT_FOUND = 'We could not find this address.';
export const ADDRESS_OTHER_COUNTRY = 'This address is in another country.';
export const ADDRESS_NEEDS_STREET = 'Please add your street and house number.';

/** Books a delivery for an order when the verified address is precise enough to drive to. */
export class DeliveryBooking {
  book(orderId: string, verified: VerifiedAddress | undefined, requestedCountry: string): Delivery {
    if (verified === undefined) return { orderId, status: 'rejected', reason: ADDRESS_NOT_FOUND };
    if (verified.country !== requestedCountry) {
      return { orderId, status: 'rejected', reason: ADDRESS_OTHER_COUNTRY };
    }
    if (verified.confidence < MIN_CONFIDENCE) return { orderId, status: 'rejected', reason: ADDRESS_NOT_FOUND };
    if (verified.precision === 'area') return { orderId, status: 'rejected', reason: ADDRESS_NEEDS_STREET };
    return { orderId, status: 'scheduled', address: verified.formatted, point: verified.point };
  }
}
