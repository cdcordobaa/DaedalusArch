import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import { AddressVerifierUnavailableError, type AddressVerifier } from '../ports/out/AddressVerifier';

const MIN_CONFIDENCE = 0.8;

export class ScheduleDeliveryService implements ScheduleDelivery {
  constructor(
    private readonly verifier: AddressVerifier,
    private readonly booking: DeliveryBooking = new DeliveryBooking(),
  ) {}

  async schedule(request: DeliveryRequest): Promise<DeliveryView> {
    const address = DeliveryAddress.of(request.street, request.postcode, request.city, request.country);
    let match;
    try {
      match = await this.verifier.verify(address);
    } catch (e) {
      if (!(e instanceof AddressVerifierUnavailableError)) throw e;
      const unverified = this.booking.book(request.orderId, address.oneLine());
      return { orderId: unverified.orderId, status: unverified.status, address: unverified.address, unverified: true };
    }
    if (!match || match.confidence < MIN_CONFIDENCE) return this.reject(request, 'We could not find this address.');
    if (match.country.toUpperCase() !== address.country) return this.reject(request, 'This address is in another country.');
    if (match.precision === 'LOCALITY' || match.precision === 'POSTCODE') {
      return this.reject(request, 'Please add your street and house number.');
    }
    const delivery = this.booking.book(request.orderId, match.formatted, match.point);
    return {
      orderId: delivery.orderId,
      status: delivery.status,
      address: delivery.address,
      latitude: delivery.point?.latitude,
      longitude: delivery.point?.longitude,
      unverified: delivery.unverified,
    };
  }

  private reject(request: DeliveryRequest, reason: string): DeliveryView {
    return { orderId: request.orderId, status: 'rejected', reason };
  }
}
