import type { Booking } from '../domain/booking';
import type { BookingRepository } from '../domain/booking-repository';

export class ReturnKayak {
  constructor(private readonly bookings: BookingRepository) {}

  async execute(bookingId: string, now = new Date()): Promise<Booking> {
    const booking = await this.bookings.findById(bookingId);
    if (booking === undefined) throw new Error(`unknown booking ${bookingId}`);
    if (booking.status !== 'out') throw new Error(`booking ${bookingId} is not out on the water`);
    booking.status = 'returned';
    booking.returnedAt = now;
    await this.bookings.save(booking);
    return booking;
  }
}
