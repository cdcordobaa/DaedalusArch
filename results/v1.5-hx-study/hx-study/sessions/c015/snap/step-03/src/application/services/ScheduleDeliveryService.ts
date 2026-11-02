import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import { AddressVerifierUnavailableError, type AddressVerifier } from '../ports/out/AddressVerifier';

export class ScheduleDeliveryService implements ScheduleDelivery {
  constructor(
    private readonly addresses: AddressVerifier,
    private readonly booking: DeliveryBooking = new DeliveryBooking(),
  ) {}

  async schedule(request: DeliveryRequest): Promise<DeliveryView> {
    const address = DeliveryAddress.of(request.street, request.postcode, request.city, request.country);
    let match;
    try {
      match = await this.addresses.bestMatch(address);
    } catch (e) {
      if (e instanceof AddressVerifierUnavailableError) {
        return { orderId: request.orderId, status: 'scheduled', address: address.oneLine(), unverified: true };
      }
      throw e;
    }
    const delivery = this.booking.book(request.orderId, match, address.country);
    if (delivery.status === 'rejected') {
      return { orderId: delivery.orderId, status: delivery.status, reason: delivery.reason };
    }
    return {
      orderId: delivery.orderId,
      status: delivery.status,
      address: delivery.address,
      latitude: delivery.point.latitude,
      longitude: delivery.point.longitude,
      unverified: false,
    };
  }
}
