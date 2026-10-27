import { DeliveryAddress } from '../../domain/model/DeliveryAddress';
import { DeliveryBooking } from '../../domain/services/DeliveryBooking';
import type { DeliveryRequest, DeliveryView, ScheduleDelivery } from '../ports/in/ScheduleDelivery';

export class ScheduleDeliveryService implements ScheduleDelivery {
  constructor(private readonly booking: DeliveryBooking = new DeliveryBooking()) {}

  async schedule(request: DeliveryRequest): Promise<DeliveryView> {
    const address = DeliveryAddress.of(request.street, request.postcode, request.city, request.country);
    const delivery = this.booking.book(request.orderId, address);
    return { orderId: delivery.orderId, status: delivery.status, address: delivery.address };
  }
}
