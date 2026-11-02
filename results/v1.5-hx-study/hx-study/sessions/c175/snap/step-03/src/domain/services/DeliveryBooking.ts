import type { Delivery } from '../model/Delivery';
import type { DeliveryAddress } from '../model/DeliveryAddress';
import type { GeoPoint } from '../model/GeoPoint';

/** Books a delivery for an order to an address whose format we have checked. */
export class DeliveryBooking {
  book(orderId: string, address: DeliveryAddress): Delivery {
    return { orderId, status: 'scheduled', address: address.oneLine() };
  }

  /** Books a delivery to a verified address, as the geocoder writes it. */
  bookVerified(orderId: string, address: string, point: GeoPoint): Delivery {
    return { orderId, status: 'scheduled', address, point };
  }
}
