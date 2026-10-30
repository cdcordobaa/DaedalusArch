import type { Delivery } from '../model/Delivery';
import type { VerifiedAddress } from '../model/VerifiedAddress';

/** Books a delivery for an order to an address that has been verified. */
export class DeliveryBooking {
  book(orderId: string, address: VerifiedAddress): Delivery {
    return { orderId, status: 'scheduled', address: address.address, point: address.point };
  }
}
