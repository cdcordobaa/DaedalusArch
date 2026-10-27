import { AddressLookupUnavailable } from '../../domain/errors/AddressLookupUnavailable';
import type { Delivery } from '../../domain/model/Delivery';
import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { AddressCheck } from '../../domain/services/AddressCheck';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';
import type { AddressLookup } from '../ports/out/AddressLookup';

export class ScheduleDeliveryService implements ScheduleDelivery {
  constructor(
    private readonly lookup: AddressLookup,
    private readonly check: AddressCheck = new AddressCheck(),
    private readonly booking: DeliveryBooking = new DeliveryBooking(),
  ) {}

  async schedule(request: DeliveryRequest): Promise<DeliveryView> {
    const address = DeliveryAddress.of(request.street, request.postcode, request.city, request.country);
    const delivery = await this.checkedOrAsTyped(request.orderId, address);
    if (delivery.status === 'rejected') return { orderId: delivery.orderId, status: delivery.status, reason: delivery.reason };
    return { orderId: delivery.orderId, status: delivery.status, address: delivery.address, latitude: delivery.point?.latitude, longitude: delivery.point?.longitude, unverified: delivery.unverified };
  }

  private async checkedOrAsTyped(orderId: string, address: DeliveryAddress): Promise<Delivery> {
    try {
      const verdict = this.check.verdict(address, await this.lookup.matchesFor(address));
      return verdict.accepted ? this.booking.bookAt(orderId, verdict.match) : this.booking.refuse(orderId, verdict.reason);
    } catch (e) {
      if (e instanceof AddressLookupUnavailable) return this.booking.book(orderId, address);
      throw e;
    }
  }
}
