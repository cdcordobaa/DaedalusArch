import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import { AddressVerifierUnavailableError, type AddressVerifier } from '../ports/out/AddressVerifier';

export class ScheduleDeliveryService implements ScheduleDelivery {
  constructor(
    private readonly verifier: AddressVerifier,
    private readonly booking: DeliveryBooking = new DeliveryBooking(),
  ) {}

  async schedule(request: DeliveryRequest): Promise<DeliveryView> {
    const address = DeliveryAddress.of(request.street, request.postcode, request.city, request.country);
    let verified;
    try {
      verified = await this.verifier.verify(address);
    } catch (e) {
      if (!(e instanceof AddressVerifierUnavailableError)) throw e;
      const unverifiedDelivery = this.booking.book(request.orderId, address.oneLine());
      return {
        orderId: unverifiedDelivery.orderId,
        status: unverifiedDelivery.status,
        address: unverifiedDelivery.address,
        unverified: true,
      };
    }
    if (!verified || !verified.drivable) {
      return { orderId: request.orderId, status: 'rejected', reason: 'We could not find this address.' };
    }
    const delivery = this.booking.book(request.orderId, verified.formatted);
    return {
      orderId: delivery.orderId,
      status: delivery.status,
      address: delivery.address,
      latitude: verified.point.latitude,
      longitude: verified.point.longitude,
      unverified: false,
    };
  }
}
