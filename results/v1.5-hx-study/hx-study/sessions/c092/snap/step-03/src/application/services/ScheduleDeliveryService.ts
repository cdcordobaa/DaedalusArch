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
      match = await this.geocoder.bestMatch(address);
    } catch (e) {
      if (!(e instanceof GeocoderUnavailableError)) throw e;
      const d = this.booking.book(request.orderId, address.oneLine());
      return { orderId: d.orderId, status: d.status, address: d.address, unverified: true };
    }
    const reject = (reason: string): DeliveryView => ({ orderId: request.orderId, status: 'rejected', reason });
    if (!match) return reject('We could not find this address.');
    if (match.countryCode !== address.country) return reject('This address is in another country.');
    if (match.confidence < MIN_CONFIDENCE) return reject('We could not find this address.');
    if (match.precision !== 'ROOFTOP' && match.precision !== 'STREET') return reject('Please add your street and house number.');
    const delivery = this.booking.book(request.orderId, match.formattedAddress, match.point);
    return {
      orderId: delivery.orderId,
      status: delivery.status,
      address: delivery.address,
      latitude: delivery.point?.latitude,
      longitude: delivery.point?.longitude,
      unverified: false,
    };
  }
}
