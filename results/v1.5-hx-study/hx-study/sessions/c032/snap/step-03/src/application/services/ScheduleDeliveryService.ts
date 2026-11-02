import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import type { AddressVerifier, RejectionCause } from '../ports/out/AddressVerifier';

const REASONS: Record<RejectionCause, string> = {
  NOT_FOUND: 'We could not find this address.',
  OTHER_COUNTRY: 'This address is in another country.',
  STREET_MISSING: 'Please add your street and house number.',
};

export class ScheduleDeliveryService implements ScheduleDelivery {
  constructor(
    private readonly verifier: AddressVerifier,
    private readonly booking: DeliveryBooking = new DeliveryBooking(),
  ) {}

  async schedule(request: DeliveryRequest): Promise<DeliveryView> {
    const address = DeliveryAddress.of(request.street, request.postcode, request.city, request.country);
    const verified = await this.verifier.verify(address);
    if (!verified || 'rejected' in verified) {
      const reason = verified ? REASONS[verified.rejected] : REASONS.NOT_FOUND;
      return { orderId: request.orderId, status: 'rejected', address: address.oneLine(), reason };
    }
    const delivery = this.booking.book(request.orderId, verified.address, verified.point);
    return {
      orderId: delivery.orderId,
      status: delivery.status,
      address: delivery.address,
      latitude: delivery.point?.latitude,
      longitude: delivery.point?.longitude,
      unverified: verified.unverified === true,
    };
  }
}
