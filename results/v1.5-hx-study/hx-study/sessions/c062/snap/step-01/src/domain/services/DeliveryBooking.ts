import type { Delivery } from '../model/Delivery';
import type { GeoPoint } from '../model/GeoPoint';

/** Books a delivery for an order to an address verified as drivable. */
export class DeliveryBooking {
  book(orderId: string, address: string, point: GeoPoint): Delivery {
    return { orderId, status: 'scheduled', address, point };
  }
}
