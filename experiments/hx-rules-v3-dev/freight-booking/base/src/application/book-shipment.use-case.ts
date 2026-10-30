import { BookingNotFoundError } from '../domain/errors';
import { BookShipmentCommand, BookShipmentPort, BookShipmentResult } from './ports/in/book-shipment.port';
import { BookingRepositoryPort } from './ports/out/booking-repository.port';
import { CarrierBookingPort } from './ports/out/carrier-booking.port';
import { ShipperNotifierPort } from './ports/out/shipper-notifier.port';

export class BookShipmentUseCase implements BookShipmentPort {
  constructor(
    private readonly bookings: BookingRepositoryPort,
    private readonly carrier: CarrierBookingPort,
    private readonly notifier: ShipperNotifierPort,
  ) {}

  async book(command: BookShipmentCommand): Promise<BookShipmentResult> {
    const booking = await this.bookings.findById(command.bookingId);
    if (booking === null) throw new BookingNotFoundError(command.bookingId);
    const answer = await this.carrier.request({ shipperId: booking.shipperId, laneCode: booking.laneCode, palletCount: booking.palletCount });
    booking.record(answer);
    await this.bookings.save(booking);
    await this.notifier.notifyBooking(booking.shipperId, booking.id, booking.currentStatus);
    return { bookingId: booking.id, status: booking.currentStatus, chargeCents: booking.charge };
  }
}
