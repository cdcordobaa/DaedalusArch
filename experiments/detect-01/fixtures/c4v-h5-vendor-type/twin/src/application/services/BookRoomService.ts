import { Booking } from '../../domain/model/Booking';
import { DateRange } from '../../domain/model/DateRange';
import type { BookingRepository } from '../ports/out/BookingRepository';

export class BookRoomService {
  constructor(private readonly bookings: BookingRepository) {}

  async book(roomId: string, stay: DateRange): Promise<Booking> {
    return this.bookings.inTransaction(async (work) => {
      const existing = await this.bookings.findByRoom(roomId, work);
      if (existing.some((b) => b.isActive() && b.stay.overlaps(stay))) throw new Error(`Room ${roomId} is already booked`);
      const booking = new Booking(this.bookings.nextId(), roomId, stay);
      await this.bookings.save(booking, work);
      return booking;
    });
  }
}
