import { PERMIT_RETRY_LIMIT } from '../adapters/out/permits';
import { PermitClearance } from '../domain/permit';
import { BookingNotFoundError, PermitRegistryUnavailableError } from '../domain/errors';
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
    let clearance: PermitClearance | null = null;
    for (let attempt = 0; clearance === null; attempt++) {
      try {
        clearance = await this.permits.apply({
          routeCode: booking.routeCode,
          partySize: booking.partySize,
          ascentDate: booking.ascentDate,
          guideLicence: booking.guideLicence,
        });
      } catch (e) {
        if (!(e instanceof PermitRegistryUnavailableError) || attempt + 1 >= PERMIT_RETRY_LIMIT) throw e;
      }
    }
    booking.confirm(clearance);
    await this.bookings.save(booking);
    await this.notifier.notify(booking.clientId, booking.id, booking.currentStatus);
    return { bookingId: booking.id, status: booking.currentStatus };
  }
}
