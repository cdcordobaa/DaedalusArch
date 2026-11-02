import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import { AddressVerificationUnavailableError, type AddressVerification } from '../ports/out/AddressVerification';

const MIN_CONFIDENCE = 0.8;

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
      if (!(e instanceof AddressVerificationUnavailableError)) throw e;
      const delivery = this.booking.book(request.orderId, address);
      return { orderId: delivery.orderId, status: delivery.status, address: delivery.address, unverified: true };
    }
    if (
      !match ||
      match.accuracy === 'area' ||
      !(match.confidence >= MIN_CONFIDENCE)
    ) {
      return { orderId: request.orderId, status: 'rejected', reason: 'We could not find this address.' };
    }
    const delivery = this.booking.bookVerified(request.orderId, match.standardAddress, match.point);
    return {
      orderId: delivery.orderId,
      status: delivery.status,
      address: delivery.address,
      latitude: match.point.latitude,
      longitude: match.point.longitude,
      unverified: false,
    };
  }
}
