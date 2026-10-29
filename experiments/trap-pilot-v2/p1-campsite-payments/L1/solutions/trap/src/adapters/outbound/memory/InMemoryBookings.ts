import type { Booking } from '../../../domain/model/Booking';
import type { Bookings } from '../../../application/ports/out/Bookings';

export class InMemoryBookings implements Bookings {
  private readonly rows = new Map<string, Booking>();

  async save(booking: Booking): Promise<void> {
    this.rows.set(booking.bookingId, booking);
  }

  async get(bookingId: string): Promise<Booking | null> {
    return this.rows.get(bookingId) ?? null;
  }
}
