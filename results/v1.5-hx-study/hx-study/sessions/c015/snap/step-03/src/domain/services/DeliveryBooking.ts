import type { Delivery } from '../model/Delivery';
import type { GeocodedAddress } from '../model/GeocodedAddress';

export const ADDRESS_NOT_FOUND = 'We could not find this address.';
export const ADDRESS_OTHER_COUNTRY = 'This address is in another country.';
export const ADDRESS_NEEDS_STREET = 'Please add your street and house number.';
const MIN_CONFIDENCE = 0.8;

/** Books a delivery when the best match is precise enough to drive to. */
export class DeliveryBooking {
  book(orderId: string, match: GeocodedAddress | undefined, chosenCountry: string): Delivery {
    const reject = (reason: string): Delivery => ({ orderId, status: 'rejected', reason });
    if (match === undefined || match.confidence < MIN_CONFIDENCE) return reject(ADDRESS_NOT_FOUND);
    if (match.country !== chosenCountry) return reject(ADDRESS_OTHER_COUNTRY);
    if (match.precision === 'area') return reject(ADDRESS_NEEDS_STREET);
    return { orderId, status: 'scheduled', address: match.standardSpelling, point: match.point };
  }
}
