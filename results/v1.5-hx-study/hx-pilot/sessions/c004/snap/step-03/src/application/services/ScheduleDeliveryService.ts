import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import type { AddressVerification } from '../ports/out/AddressVerification';

const REASONS = {
  NOT_FOUND: 'We could not find this address.',
  OTHER_COUNTRY: 'This address is in another country.',
  STREET_MISSING: 'Please add your street and house number.',
} as const;

export class ScheduleDeliveryService implements ScheduleDelivery {
  constructor(
    private readonly verification: AddressVerification,
    private readonly booking: DeliveryBooking = new DeliveryBooking(),
  ) {}

  async schedule(request: DeliveryRequest): Promise<DeliveryView> {
    const address = DeliveryAddress.of(request.street, request.postcode, request.city, request.country);
    const verified = await this.verification.verify(address);
    if ('rejected' in verified) {
      return { orderId: request.orderId, status: 'rejected', reason: REASONS[verified.rejected] };
    }
    const delivery = this.booking.book(request.orderId, verified);
    return {
      orderId: delivery.orderId,
      status: delivery.status,
      address: delivery.address,
      latitude: delivery.point?.latitude,
      longitude: delivery.point?.longitude,
      unverified: delivery.unverified,
    };
  }
}
