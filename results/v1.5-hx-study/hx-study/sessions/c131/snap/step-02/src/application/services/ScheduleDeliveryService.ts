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
    let located;
    try {
      located = await this.verification.verify(address);
    } catch {
      // Verification service unavailable: schedule to the address as typed, unverified.
      return { orderId: request.orderId, status: 'scheduled', address: address.oneLine(), unverified: true };
    }
    const delivery = this.booking.book(request.orderId, located);
    if (!delivery) {
      return { orderId: request.orderId, status: 'rejected', reason: 'We could not find this address.' };
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
