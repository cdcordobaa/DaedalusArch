import type { Delivery } from '../model/Delivery';

/** Books a delivery for an order to an address already verified by the geocoder. */
export class DeliveryBooking {
  book(orderId: string, verifiedAddress: string): Delivery {
    return { orderId, status: 'scheduled', address: verifiedAddress };
  }
}
