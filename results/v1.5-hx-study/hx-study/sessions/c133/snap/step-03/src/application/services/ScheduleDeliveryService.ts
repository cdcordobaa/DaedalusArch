import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import { GeocoderUnavailableError, type AddressGeocoder } from '../ports/out/AddressGeocoder';

const MIN_CONFIDENCE = 0.8;

export class ScheduleDeliveryService implements ScheduleDelivery {
  constructor(
    private readonly geocoder: AddressGeocoder,
    private readonly booking: DeliveryBooking = new DeliveryBooking(),
  ) {}

  async schedule(request: DeliveryRequest): Promise<DeliveryView> {
    const address = DeliveryAddress.of(request.street, request.postcode, request.city, request.country);
    let match;
    try {
      match = await this.geocoder.best(address);
    } catch (e) {
      if (!(e instanceof GeocoderUnavailableError)) throw e;
      const fallback = this.booking.book(request.orderId, address.oneLine());
      return { orderId: fallback.orderId, status: fallback.status, address: fallback.address, unverified: true };
    }
    if (!match || !(match.confidence >= MIN_CONFIDENCE)) {
      return this.reject(request, 'We could not find this address.');
    }
    if (match.countryIso !== address.country) {
      return this.reject(request, 'This address is in another country.');
    }
    if (match.precision !== 'ROOFTOP' && match.precision !== 'STREET') {
      return this.reject(request, 'Please add your street and house number.');
    }
    const delivery = this.booking.book(request.orderId, match.formattedAddress);
    return {
      orderId: delivery.orderId,
      status: delivery.status,
      address: delivery.address,
      latitude: match.point.latitude,
      longitude: match.point.longitude,
      unverified: false,
    };
  }

  private reject(request: DeliveryRequest, reason: string): DeliveryView {
    return { orderId: request.orderId, status: 'rejected', reason };
  }
}
