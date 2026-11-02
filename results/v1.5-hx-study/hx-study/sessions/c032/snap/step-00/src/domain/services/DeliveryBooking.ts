import type { Delivery } from '../model/Delivery';
import type { DeliveryAddress } from '../model/DeliveryAddress';

/** Books a delivery for an order to an address whose format we have checked. */
export class DeliveryBooking {
  book(orderId: string, address: DeliveryAddress): Delivery {
    return { orderId, status: 'scheduled', address: address.oneLine() };
  }
}
