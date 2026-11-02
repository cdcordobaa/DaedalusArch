import type { Delivery } from '../model/Delivery';
import type { GeocodedAddress } from '../model/GeocodedAddress';

export const ADDRESS_NOT_FOUND = 'We could not find this address.';
export const ADDRESS_OTHER_COUNTRY = 'This address is in another country.';
export const ADDRESS_NEEDS_STREET = 'Please add your street and house number.';
const MIN_CONFIDENCE = 0.8;

/** Books a delivery only when the geocoded address is precise enough to drive to. */
export class DeliveryBooking {
  book(orderId: string, match: GeocodedAddress | null, country: string): Delivery {
    if (match === null || match.confidence < MIN_CONFIDENCE) {
      return { orderId, status: 'rejected', reason: ADDRESS_NOT_FOUND };
    }
    if (match.country.toUpperCase() !== country.toUpperCase()) {
      return { orderId, status: 'rejected', reason: ADDRESS_OTHER_COUNTRY };
    }
    if (match.accuracy !== 'building' && match.accuracy !== 'street') {
      return { orderId, status: 'rejected', reason: ADDRESS_NEEDS_STREET };
    }
    return { orderId, status: 'scheduled', address: match.formatted, point: match.point };
  }
}
