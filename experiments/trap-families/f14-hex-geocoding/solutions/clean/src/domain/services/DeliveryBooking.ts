import type { AddressMatch } from '../model/AddressMatch';
import type { Delivery } from '../model/Delivery';
import type { DeliveryAddress } from '../model/DeliveryAddress';

/** Books a delivery for an order: to a checked place, or to an address whose format we have checked. */
export class DeliveryBooking {
  book(orderId: string, address: DeliveryAddress): Delivery {
    return { orderId, status: 'scheduled', address: address.oneLine(), unverified: true };
  }

  bookAt(orderId: string, match: AddressMatch): Delivery {
    return { orderId, status: 'scheduled', address: match.label, point: match.point, unverified: false };
  }

  refuse(orderId: string, reason: string): Delivery {
    return { orderId, status: 'rejected', reason };
  }
}
