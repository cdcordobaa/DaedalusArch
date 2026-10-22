import { BookingError } from '../domain/BookingError';
import type { BookingRepository } from '../domain/booking/BookingRepository';
import { BookingId } from '../domain/booking/value-objects/BookingId';

/** Flags one booking whose sailing was cancelled. */
export class MarkSailingCancelled {
  constructor(private readonly bookings: BookingRepository) {}

  execute(bookingId: string): void {
    const booking = this.bookings.byId(BookingId.of(bookingId));
    if (booking === undefined) throw new BookingError(`no booking ${bookingId}`);
    booking.sailingCancelled();
    this.bookings.save(booking);
  }
}
