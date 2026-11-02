import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import type { AddressVerification } from '../ports/out/AddressVerification';

export class ScheduleDeliveryService implements ScheduleDelivery {
  constructor(
    private readonly verification: AddressVerification,
    private readonly booking: DeliveryBooking = new DeliveryBooking(),
  ) {}

  async schedule(request: DeliveryRequest): Promise<DeliveryView> {
    const address = DeliveryAddress.of(request.street, request.postcode, request.city, request.country);
    let match;
    try {
      match = await this.verification.bestMatch(address);
    } catch {
      // Geopin unavailable: schedule to the address as typed, unverified.
      return { orderId: request.orderId, status: 'scheduled', address: address.oneLine(), unverified: true };
    }
    const delivery = this.booking.book(request.orderId, match);
    if (delivery.status === 'rejected') {
      return { orderId: delivery.orderId, status: delivery.status, reason: delivery.reason, unverified: false };
    }
    return {
      orderId: delivery.orderId,
      status: delivery.status,
      unverified: false,
      address: delivery.address,
      latitude: delivery.point.latitude,
      longitude: delivery.point.longitude,
    };
  }
}
