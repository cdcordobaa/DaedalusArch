import { Booking } from '../../domain/model/Booking';
import { DateRange } from '../../domain/model/DateRange';
import type { BookingRepository } from '../ports/out/BookingRepository';

export class BookRoomService {
  constructor(private readonly bookings: BookingRepository) {}

  async book(roomId: string, stay: DateRange): Promise<Booking> {
    return this.bookings.withRoomLock(roomId, async (tx) => {
      const existing = await tx.findByRoom(roomId);
      if (existing.some((b) => b.isActive() && b.stay.overlaps(stay))) throw new Error(`Room ${roomId} is already booked`);
      const booking = new Booking(tx.nextId(), roomId, stay);
      await tx.save(booking);
      return booking;
    });
  }
}
