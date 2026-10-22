import type { BookingView } from '../contracts/BookingView';
import type { BookingRepository } from '../domain/booking/BookingRepository';
import { BookingId } from '../domain/booking/value-objects/BookingId';

export class GetBooking {
  constructor(private readonly bookings: BookingRepository) {}

  execute(bookingId: string): BookingView | undefined {
    const booking = this.bookings.byId(BookingId.of(bookingId));
    if (booking === undefined) return undefined;
    return { id: booking.id.value, passenger: booking.passenger, sailingId: booking.sailingId, seats: booking.seats, status: booking.status };
  }
}
