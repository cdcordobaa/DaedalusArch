import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import type { AddressGeocoder } from '../ports/out/AddressGeocoder';

const MIN_CONFIDENCE = 0.8;

export class ScheduleDeliveryService implements ScheduleDelivery {
  constructor(
    private readonly geocoder: AddressGeocoder,
    private readonly booking: DeliveryBooking = new DeliveryBooking(),
  ) {}

  async schedule(request: DeliveryRequest): Promise<DeliveryView> {
    const address = DeliveryAddress.of(request.street, request.postcode, request.city, request.country);
    const match = await this.geocoder.bestMatch(address);
    const drivable = match !== null && (match.precision === 'ROOFTOP' || match.precision === 'STREET') && match.confidence >= MIN_CONFIDENCE;
    if (!match || !drivable) {
      return { orderId: request.orderId, status: 'rejected', reason: 'We could not find this address.' };
    }
    const delivery = this.booking.book(request.orderId, match.formattedAddress, match.point);
    return {
      orderId: delivery.orderId,
      status: delivery.status,
      address: delivery.address,
      latitude: delivery.point.latitude,
      longitude: delivery.point.longitude,
    };
  }
}
