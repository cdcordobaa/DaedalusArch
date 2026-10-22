import { BookingError } from '../domain/BookingError';
import type { BookingRepository } from '../domain/booking/BookingRepository';
import { BookingCancelled } from '../domain/booking/events/BookingCancelled';
import { BookingId } from '../domain/booking/value-objects/BookingId';
import type { EventPublisher } from './ports/EventPublisher';

export class CancelBooking {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly events: EventPublisher,
  ) {}

  execute(bookingId: string): void {
    const booking = this.bookings.byId(BookingId.of(bookingId));
    if (booking === undefined) throw new BookingError(`no booking ${bookingId}`);
    const wasConfirmed = booking.status === 'confirmed';
    booking.cancel();
    if (wasConfirmed) this.events.publish(new BookingCancelled(booking.id.value, booking.sailingId));
    this.bookings.save(booking);
  }
}
