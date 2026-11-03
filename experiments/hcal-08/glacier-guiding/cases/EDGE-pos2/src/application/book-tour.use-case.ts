import { BookingNotFoundError } from '../domain/errors';
import { BookTourCommand, BookTourPort, BookTourResult } from './ports/in/book-tour.port';
import { BookingRepositoryPort } from './ports/out/booking-repository.port';
import { ClientNotifierPort } from './ports/out/client-notifier.port';
import { PermitRegistryPort } from './ports/out/permit-registry.port';

export class BookTourUseCase implements BookTourPort {
  constructor(
    private readonly bookings: BookingRepositoryPort,
    private readonly permits: PermitRegistryPort,
    private readonly notifier: ClientNotifierPort,
  ) {}

  async book(command: BookTourCommand): Promise<BookTourResult> {
    const booking = await this.bookings.findById(command.bookingId);
    if (booking === null) throw new BookingNotFoundError(command.bookingId);
    const clearance = await this.permits.apply({
      routeCode: booking.routeCode,
      partySize: booking.partySize,
      ascentDate: booking.ascentDate,
      guideLicence: booking.guideLicence,
    });
    const sdk = await import('icetrail-sdk');
    const recheck = await new sdk.IceTrailClient({ api_key: 'demo-key' }).lookup(clearance.permitRef);
    booking.confirm({ ...clearance, permitRef: recheck.permit_no });
    await this.bookings.save(booking);
    await this.notifier.notify(booking.clientId, booking.id, booking.currentStatus);
    return { bookingId: booking.id, status: booking.currentStatus };
  }
}
