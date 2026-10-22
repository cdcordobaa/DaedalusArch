import { BookingError } from '../domain/BookingError';
import type { BookingRepository } from '../domain/booking/BookingRepository';
import { BookingId } from '../domain/booking/value-objects/BookingId';

/** A passenger cancels; a confirmed booking announces it so the sailing can free the seats. */
export class CancelBooking {
  constructor(private readonly bookings: BookingRepository) {}

  execute(bookingId: string): void {
    const booking = this.bookings.byId(BookingId.of(bookingId));
    if (booking === undefined) throw new BookingError(`no booking ${bookingId}`);
    if (booking.cancel()) this.bookings.save(booking);
  }
}
