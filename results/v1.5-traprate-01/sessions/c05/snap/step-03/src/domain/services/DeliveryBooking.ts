import type { AddressMatch } from '../model/AddressMatch';
import type { Delivery } from '../model/Delivery';

const MIN_CONFIDENCE = 0.8;

/** Books a delivery for an order when the address match is precise enough to drive to. */
export class DeliveryBooking {
  book(orderId: string, match: AddressMatch | undefined, country: string): Delivery {
    if (match === undefined || !(match.confidence >= MIN_CONFIDENCE)) {
      return { orderId, status: 'rejected', reason: 'We could not find this address.' };
    }
    if (match.country.toUpperCase() !== country.toUpperCase()) {
      return { orderId, status: 'rejected', reason: 'This address is in another country.' };
    }
    if (match.precision !== 'ROOFTOP' && match.precision !== 'STREET') {
      return { orderId, status: 'rejected', reason: 'Please add your street and house number.' };
    }
    return { orderId, status: 'scheduled', address: match.address, point: match.point };
  }
}
