import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import { GeocoderUnavailableError, type AddressGeocoder } from '../ports/out/AddressGeocoder';

export class ScheduleDeliveryService implements ScheduleDelivery {
  constructor(
    private readonly geocoder: AddressGeocoder,
    private readonly booking: DeliveryBooking = new DeliveryBooking(),
  ) {}

  async schedule(request: DeliveryRequest): Promise<DeliveryView> {
    const address = DeliveryAddress.of(request.street, request.postcode, request.city, request.country);
    try {
      const match = await this.geocoder.geocode(address);
      return this.booking.book(request.orderId, match, address.country);
    } catch (e) {
      if (e instanceof GeocoderUnavailableError) return this.booking.bookUnverified(request.orderId, address.oneLine());
      throw e;
    }
  }
}
