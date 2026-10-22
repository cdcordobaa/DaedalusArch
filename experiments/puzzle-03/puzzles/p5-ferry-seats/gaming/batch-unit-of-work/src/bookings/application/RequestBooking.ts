import { BookingError } from '../domain/BookingError';
import { Booking } from '../domain/booking/Booking';
import type { BookingRepository } from '../domain/booking/BookingRepository';
import type { UnitOfWork } from '../../messaging/UnitOfWork';
import type { SailingDirectory } from './ports/SailingDirectory';

export class RequestBooking {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly sailings: SailingDirectory,
    private readonly unit: UnitOfWork,
  ) {}

  execute(passenger: string, sailingId: string, seats: number): string {
    if (!this.sailings.exists(sailingId)) throw new BookingError(`no sailing ${sailingId}`);
    const booking = Booking.request(this.bookings.nextId(), passenger, sailingId, seats);
    try {
      booking.confirm();
      this.unit.run([() => this.sailings.holdSeats(sailingId, booking.id.value, seats), () => this.bookings.save(booking)]);
    } catch {
      booking.reject();
      this.bookings.save(booking);
    }
    return booking.id.value;
  }
}
