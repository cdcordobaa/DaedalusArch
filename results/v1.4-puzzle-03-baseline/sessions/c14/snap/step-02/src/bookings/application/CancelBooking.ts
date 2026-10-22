import { BookingError } from '../domain/BookingError';
import type { BookingRepository } from '../domain/booking/BookingRepository';
import { BookingId } from '../domain/booking/value-objects/BookingId';
import type { SailingDirectory } from './ports/SailingDirectory';

export class CancelBooking {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly sailings: SailingDirectory,
  ) {}

  execute(bookingId: string): void {
    const booking = this.bookings.byId(BookingId.of(bookingId));
    if (booking === undefined) throw new BookingError(`no booking ${bookingId}`);
    if (!booking.cancel()) return;
    this.sailings.release(booking.sailingId, booking.id.value);
    this.bookings.save(booking);
  }
}
