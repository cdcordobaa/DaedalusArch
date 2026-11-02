import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import type { AddressVerifier, RejectionReason } from '../ports/out/AddressVerifier';

const REASONS: Record<RejectionReason, string> = {
  OTHER_COUNTRY: 'This address is in another country.',
  STREET_MISSING: 'Please add your street and house number.',
  NOT_FOUND: 'We could not find this address.',
};

export class ScheduleDeliveryService implements ScheduleDelivery {
  constructor(
    private readonly verifier: AddressVerifier,
    private readonly booking: DeliveryBooking = new DeliveryBooking(),
  ) {}

  async schedule(request: DeliveryRequest): Promise<DeliveryView> {
    const address = DeliveryAddress.of(request.street, request.postcode, request.city, request.country);
    const verified = await this.verifier.verify(address);
    if ('rejected' in verified) {
      return { orderId: request.orderId, status: 'rejected', reason: REASONS[verified.reason] };
    }
    const delivery = this.booking.book(request.orderId, verified.address, verified.point);
    return {
      orderId: delivery.orderId,
      status: delivery.status,
      address: delivery.address,
      ...(delivery.point ? { latitude: delivery.point.latitude, longitude: delivery.point.longitude } : {}),
      unverified: verified.unverified,
    };
  }
}
