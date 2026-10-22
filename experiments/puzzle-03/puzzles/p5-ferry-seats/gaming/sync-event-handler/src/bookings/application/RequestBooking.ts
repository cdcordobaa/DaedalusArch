import { BookingError } from '../domain/BookingError';
import { Booking } from '../domain/booking/Booking';
import type { BookingRepository } from '../domain/booking/BookingRepository';
import { BookingRequested } from '../domain/booking/events/BookingRequested';
import type { EventPublisher } from './ports/EventPublisher';
import type { SailingDirectory } from './ports/SailingDirectory';

export class RequestBooking {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly sailings: SailingDirectory,
    private readonly events: EventPublisher,
  ) {}

  execute(passenger: string, sailingId: string, seats: number): string {
    if (!this.sailings.exists(sailingId)) throw new BookingError(`no sailing ${sailingId}`);
    const booking = Booking.request(this.bookings.nextId(), passenger, sailingId, seats);
    this.events.publish(new BookingRequested(booking.id.value, sailingId, passenger, seats));
    this.bookings.save(booking);
    return booking.id.value;
  }
}
