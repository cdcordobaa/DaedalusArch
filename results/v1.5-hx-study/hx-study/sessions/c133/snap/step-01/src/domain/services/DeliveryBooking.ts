import type { Delivery } from '../model/Delivery';

/** Books a delivery for an order to a verified address, written as the geocoder spells it. */
export class DeliveryBooking {
  book(orderId: string, verifiedAddress: string): Delivery {
    return { orderId, status: 'scheduled', address: verifiedAddress };
  }
}
