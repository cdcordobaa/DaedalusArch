import type { AddressMatch } from '../model/AddressMatch';
import type { Delivery } from '../model/Delivery';

export const ADDRESS_NOT_FOUND = 'We could not find this address.';
export const ADDRESS_OTHER_COUNTRY = 'This address is in another country.';
export const ADDRESS_NEEDS_STREET = 'Please add your street and house number.';
const MIN_CONFIDENCE = 0.8;

/** Books a delivery for an order when the best match is precise enough to drive to. */
export class DeliveryBooking {
  /** `country` is the two-letter code the customer chose. */
  book(orderId: string, match: AddressMatch | undefined, country: string): Delivery {
    const reject = (reason: string): Delivery => ({ orderId, status: 'rejected', reason });
    if (match === undefined || match.confidence < MIN_CONFIDENCE) return reject(ADDRESS_NOT_FOUND);
    if (match.country.toUpperCase() !== country.toUpperCase()) return reject(ADDRESS_OTHER_COUNTRY);
    if (match.accuracy === 'area') return reject(ADDRESS_NEEDS_STREET);
    return { orderId, status: 'scheduled', address: match.address, point: match.point };
  }
}
