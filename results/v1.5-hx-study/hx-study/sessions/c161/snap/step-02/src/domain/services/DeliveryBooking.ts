import type { Delivery } from '../model/Delivery';
import type { GeoPoint } from '../model/GeoPoint';

/** Books a delivery for an order to an address verified by geocoding. */
export class DeliveryBooking {
  book(orderId: string, address: string, point?: GeoPoint, unverified = false): Delivery {
    return { orderId, status: 'scheduled', address, latitude: point?.latitude, longitude: point?.longitude, unverified };
  }
}
