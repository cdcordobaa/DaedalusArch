import type { BookingRepository } from '../ports/out/BookingRepository';

export class CancelBookingService {
  constructor(private readonly bookings: BookingRepository) {}

  async cancel(bookingId: string, userId: string): Promise<void> {
    const booking = await this.bookings.findById(bookingId);
    if (booking === undefined) throw new Error(`No booking ${bookingId}`);
    booking.cancel(userId, new Date());
    await this.bookings.save(booking);
  }
}
