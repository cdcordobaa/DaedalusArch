import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { BookingError } from '../domain/BookingError';
import type { BookingRepository } from '../domain/booking/BookingRepository';
import { BookingId } from '../domain/booking/value-objects/BookingId';

/** The fields of a sailings seat outcome that bookings cares about. */
interface SeatOutcome {
  readonly bookingId: string;
}

/** Confirms or rejects a booking once its sailing has said whether the seats were taken. */
export class SettleBooking {
  constructor(private readonly bookings: BookingRepository) {}

  handle(event: DomainEvent): void {
    const { bookingId } = event as unknown as SeatOutcome;
    const booking = this.bookings.byId(BookingId.of(bookingId));
    if (booking === undefined) throw new BookingError(`no booking ${bookingId}`);
    if (event.type === 'SeatsReserved') booking.confirm();
    else booking.reject();
    this.bookings.save(booking);
  }
}
