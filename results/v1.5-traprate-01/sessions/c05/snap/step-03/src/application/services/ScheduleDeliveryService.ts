import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import { AddressLookupUnavailableError, type AddressLookup } from '../ports/out/AddressLookup';

export class ScheduleDeliveryService implements ScheduleDelivery {
  constructor(
    private readonly addresses: AddressLookup,
    private readonly booking: DeliveryBooking = new DeliveryBooking(),
  ) {}

  async schedule(request: DeliveryRequest): Promise<DeliveryView> {
    const address = DeliveryAddress.of(request.street, request.postcode, request.city, request.country);
    let match;
    try {
      match = await this.addresses.bestMatch(address);
    } catch (e) {
      if (!(e instanceof AddressLookupUnavailableError)) throw e;
      return { orderId: request.orderId, status: 'scheduled', address: address.oneLine(), unverified: true };
    }
    const delivery = this.booking.book(request.orderId, match, address.country);
    if (delivery.status === 'rejected') return { orderId: delivery.orderId, status: 'rejected', reason: delivery.reason };
    return {
      orderId: delivery.orderId,
      status: 'scheduled',
      address: delivery.address,
      latitude: delivery.point.latitude,
      longitude: delivery.point.longitude,
      unverified: false,
    };
  }
}
