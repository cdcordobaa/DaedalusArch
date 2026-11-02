import type { Delivery } from '../model/Delivery';
import type { GeocodedAddress } from '../model/GeocodedAddress';

const MIN_CONFIDENCE = 0.8;

/** Books a delivery only when the address was located precisely enough to drive to. */
export class DeliveryBooking {
  book(orderId: string, match: GeocodedAddress | undefined, country: string): Delivery {
    const reject = (reason: string): Delivery => ({ orderId, status: 'rejected', reason });
    if (match === undefined || match.confidence < MIN_CONFIDENCE) {
      return reject('We could not find this address.');
    }
    if (match.country.toUpperCase() !== country.toUpperCase()) {
      return reject('This address is in another country.');
    }
    if (match.precision !== 'ROOFTOP' && match.precision !== 'STREET') {
      return reject('Please add your street and house number.');
    }
    return { orderId, status: 'scheduled', address: match.formattedAddress, point: match.point };
  }
}
