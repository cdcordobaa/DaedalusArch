import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import type { AddressVerification } from '../ports/out/AddressVerification';

const MIN_CONFIDENCE = 0.8;
const REJECTION_REASON = 'We could not find this address.';

export class ScheduleDeliveryService implements ScheduleDelivery {
  constructor(
    private readonly verification: AddressVerification,
    private readonly booking: DeliveryBooking = new DeliveryBooking(),
  ) {}

  async schedule(request: DeliveryRequest): Promise<DeliveryView> {
    const address = DeliveryAddress.of(request.street, request.postcode, request.city, request.country);
    const match = await this.verification.bestMatch(address);
    if (!match || (match.precision !== 'exact-building' && match.precision !== 'street-level') || !(match.confidence >= MIN_CONFIDENCE)) {
      return { orderId: request.orderId, status: 'rejected', reason: REJECTION_REASON };
    }
    const delivery = this.booking.book(request.orderId, match.standardAddress, match.point);
    return {
      orderId: delivery.orderId,
      status: delivery.status,
      address: delivery.address,
      latitude: delivery.point.latitude,
      longitude: delivery.point.longitude,
    };
  }
}
