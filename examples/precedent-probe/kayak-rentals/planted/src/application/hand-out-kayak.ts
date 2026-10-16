import type { Booking } from '../domain/booking';
import type { BookingRepository } from '../domain/booking-repository';

export class HandOutKayak {
  constructor(private readonly bookings: BookingRepository) {}

  async execute(bookingId: string): Promise<Booking> {
    const booking = await this.bookings.findById(bookingId);
    if (booking === undefined) throw new Error(`unknown booking ${bookingId}`);
    if (booking.status !== 'booked') throw new Error(`booking ${bookingId} is ${booking.status}`);
    booking.status = 'out';
    await this.bookings.save(booking);
    return booking;
  }
}
