import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import type { AddressVerifier } from '../ports/out/AddressVerifier';

export class ScheduleDeliveryService implements ScheduleDelivery {
  constructor(
    private readonly verifier: AddressVerifier,
    private readonly booking: DeliveryBooking = new DeliveryBooking(),
  ) {}

  async schedule(request: DeliveryRequest): Promise<DeliveryView> {
    const address = DeliveryAddress.of(request.street, request.postcode, request.city, request.country);
    const verified = await this.verifier.verify(address);
    if (!verified) {
      return { orderId: request.orderId, status: 'rejected', reason: 'We could not find this address.' };
    }
    if (!verified.point) {
      return { orderId: request.orderId, status: 'scheduled', address: verified.address, unverified: true };
    }
    const delivery = this.booking.book(request.orderId, verified.address, verified.point);
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
