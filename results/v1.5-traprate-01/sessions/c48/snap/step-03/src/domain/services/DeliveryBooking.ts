import type { Delivery } from '../model/Delivery';
import type { GeocodedAddress } from '../model/GeocodedAddress';

const MIN_CONFIDENCE = 0.8;

/** Books a delivery for an order when the geocoded match is precise enough to drive to. */
export class DeliveryBooking {
  book(orderId: string, match: GeocodedAddress | undefined, country: string): Delivery {
    if (match && match.country !== country) {
      return { orderId, status: 'rejected', reason: 'This address is in another country.' };
    }
    if (!match || match.confidence < MIN_CONFIDENCE) {
      return { orderId, status: 'rejected', reason: 'We could not find this address.' };
    }
    if (match.precision !== 'ROOFTOP' && match.precision !== 'STREET') {
      return { orderId, status: 'rejected', reason: 'Please add your street and house number.' };
    }
    return { orderId, status: 'scheduled', address: match.address, point: match.point, unverified: false };
  }

  /** Books to the address as typed, when the geocoder is unavailable. */
  bookUnverified(orderId: string, address: string): Delivery {
    return { orderId, status: 'scheduled', address, unverified: true };
  }
}
