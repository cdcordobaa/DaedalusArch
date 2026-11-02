import type { Delivery } from '../model/Delivery';
import type { GeocodedAddress } from '../model/GeocodedAddress';

export const ADDRESS_NOT_FOUND = 'We could not find this address.';
export const ADDRESS_OTHER_COUNTRY = 'This address is in another country.';
export const ADDRESS_STREET_MISSING = 'Please add your street and house number.';
const MIN_CONFIDENCE = 0.8;

/** Books a delivery for an order when the geocoded address is precise enough to drive to. */
export class DeliveryBooking {
  book(orderId: string, country: string, match: GeocodedAddress | undefined): Delivery {
    const reject = (reason: string): Delivery => ({ orderId, status: 'rejected', reason });
    if (!match || match.confidence < MIN_CONFIDENCE) return reject(ADDRESS_NOT_FOUND);
    if (match.country !== country) return reject(ADDRESS_OTHER_COUNTRY);
    if (match.accuracy === 'area') return reject(ADDRESS_STREET_MISSING);
    return { orderId, status: 'scheduled', address: match.formatted, point: match.point };
  }
}
