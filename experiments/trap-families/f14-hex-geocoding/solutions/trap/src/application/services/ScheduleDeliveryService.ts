import { GeopinUnavailableError } from 'geopin-sdk';
import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import type { GeocodingPort } from '../ports/out/GeocodingPort';

export class ScheduleDeliveryService implements ScheduleDelivery {
  constructor(
    private readonly geocoding: GeocodingPort,
    private readonly booking: DeliveryBooking = new DeliveryBooking(),
  ) {}

  async schedule(request: DeliveryRequest): Promise<DeliveryView> {
    const address = DeliveryAddress.of(request.street, request.postcode, request.city, request.country);
    try {
      const result = await this.geocoding.geocode({ query: { addressLine: address.street, postalCode: address.postcode, locality: address.city }, countryIso: address.country });
      const best = result.matches[0];
      const reject = (reason: string): DeliveryView => ({ orderId: request.orderId, status: 'rejected', reason });
      if (best === undefined) return reject('We could not find this address.');
      if (best.components.countryIso !== address.country) return reject('This address is in another country.');
      if (best.precision === 'LOCALITY' || best.precision === 'POSTCODE') return reject('Please add your street and house number.');
      if (best.confidence < 0.8) return reject('We could not find this address.');
      return { orderId: request.orderId, status: 'scheduled', address: best.formattedAddress, latitude: best.location.lat, longitude: best.location.lng, unverified: false };
    } catch (e) {
      if (!(e instanceof GeopinUnavailableError)) throw e;
      const delivery = this.booking.book(request.orderId, address);
      return { orderId: delivery.orderId, status: delivery.status, address: delivery.address, unverified: true };
    }
  }
}
