import { Booking } from '../../domain/model/Booking';
import { DateRange } from '../../domain/model/DateRange';
import type { BookingRepository } from '../ports/out/BookingRepository';

export class BookRoomService {
  private readonly roomLocks = new Map<string, Promise<unknown>>();

  constructor(private readonly bookings: BookingRepository) {}

  async book(roomId: string, stay: DateRange): Promise<Booking> {
    // Check and save must be one step per room, or concurrent requests all see the room as free.
    return this.withRoomLock(roomId, async () => {
      const existing = await this.bookings.findByRoom(roomId);
      if (existing.some((b) => b.isActive() && b.stay.overlaps(stay))) throw new Error(`Room ${roomId} is already booked`);
      const booking = new Booking(this.bookings.nextId(), roomId, stay);
      await this.bookings.save(booking);
      return booking;
    });
  }

  private async withRoomLock<T>(roomId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.roomLocks.get(roomId) ?? Promise.resolve();
    const run = previous.then(task, task);
    const tail = run.catch(() => undefined);
    this.roomLocks.set(roomId, tail);
    try {
      return await run;
    } finally {
      if (this.roomLocks.get(roomId) === tail) this.roomLocks.delete(roomId);
    }
  }
}
