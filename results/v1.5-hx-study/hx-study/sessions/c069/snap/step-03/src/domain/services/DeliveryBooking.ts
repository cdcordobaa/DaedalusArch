import type { Delivery } from '../model/Delivery';
import type { GeocodedAddress } from '../model/GeocodedAddress';

export const ADDRESS_NOT_FOUND = 'We could not find this address.';
export const ADDRESS_OTHER_COUNTRY = 'This address is in another country.';
export const STREET_MISSING = 'Please add your street and house number.';
const MIN_CONFIDENCE = 0.8;

/** Books a delivery for an order when the address was located precisely enough to drive to. */
export class DeliveryBooking {
  book(orderId: string, match: GeocodedAddress | undefined, requestedCountry: string): Delivery {
    if (!match || match.confidence < MIN_CONFIDENCE) {
      return { orderId, status: 'rejected', reason: ADDRESS_NOT_FOUND };
    }
    if (match.country.toUpperCase() !== requestedCountry.toUpperCase()) {
      return { orderId, status: 'rejected', reason: ADDRESS_OTHER_COUNTRY };
    }
    if (match.accuracy === 'area') {
      return { orderId, status: 'rejected', reason: STREET_MISSING };
    }
    return { orderId, status: 'scheduled', address: match.canonicalAddress, point: match.point };
  }
}
