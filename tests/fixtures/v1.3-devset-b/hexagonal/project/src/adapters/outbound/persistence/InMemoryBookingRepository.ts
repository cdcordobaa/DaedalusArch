import { BookingRepository } from '../../../application/ports/out/BookingRepository';
import { Booking } from '../../../domain/model/Booking';

export class InMemoryBookingRepository implements BookingRepository {
  private readonly rows = new Map<string, Booking>();
  private sequence = 0;

  async findById(id: string): Promise<Booking | undefined> {
    return this.rows.get(id);
  }

  async findByRoom(roomId: string): Promise<Booking[]> {
    return [...this.rows.values()].filter((b) => b.roomId === roomId);
  }

  async findActive(): Promise<Booking[]> {
    return [...this.rows.values()].filter((b) => b.isActive);
  }

  async save(booking: Booking): Promise<void> {
    this.rows.set(booking.id, booking);
  }

  nextId(): string {
    this.sequence += 1;
    return `bk-${this.sequence}`;
  }
}
