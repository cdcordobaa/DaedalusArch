import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import { AddressVerificationUnavailable } from '../ports/out/AddressVerification';
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
    } catch (e) {
      if (e instanceof AddressVerificationUnavailable) {
        return { orderId: request.orderId, status: 'scheduled', address: address.oneLine(), unverified: true };
      }
      throw e;
    }
    const delivery = this.booking.book(request.orderId, match, address.country);
    if (delivery.status === 'rejected') return delivery;
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
