import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking, type RejectionCause } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import type { AddressVerification } from '../ports/out/AddressVerification';

const REASONS: Record<RejectionCause, string> = {
  'wrong-country': 'This address is in another country.',
  'street-missing': 'Please add your street and house number.',
  'not-found': 'We could not find this address.',
};

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
    const cause = this.booking.rejectionCause(located, address.country);
    const delivery = cause ? null : this.booking.book(request.orderId, located);
    if (!delivery) {
      return { orderId: request.orderId, status: 'rejected', reason: REASONS[cause ?? 'not-found'] };
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
