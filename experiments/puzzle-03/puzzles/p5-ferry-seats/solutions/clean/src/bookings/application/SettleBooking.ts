import type { BookingRepository } from '../domain/booking/BookingRepository';
import { BookingId } from '../domain/booking/value-objects/BookingId';

/** Handles the sailing's answer to a booking's request for seats. */
export class SettleBooking {
  constructor(private readonly bookings: BookingRepository) {}

  execute(bookingId: string, held: boolean): void {
    const booking = this.bookings.byId(BookingId.of(bookingId));
    if (booking === undefined) return;
    if (held) booking.confirm();
    else booking.reject();
    this.bookings.save(booking);
  }
}
