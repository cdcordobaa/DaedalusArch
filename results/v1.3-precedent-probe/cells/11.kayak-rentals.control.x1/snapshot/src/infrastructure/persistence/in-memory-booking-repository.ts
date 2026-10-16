import type { Booking } from '../../domain/booking';
import type { BookingRepository } from '../../domain/booking-repository';

export class InMemoryBookingRepository implements BookingRepository {
  private readonly rows = new Map<string, Booking>();

  async findById(id: string): Promise<Booking | undefined> {
    return this.rows.get(id);
  }

  async findByKayak(kayakId: string): Promise<Booking[]> {
    return [...this.rows.values()].filter((b) => b.kayakId === kayakId);
  }

  async save(booking: Booking): Promise<void> {
    this.rows.set(booking.id, booking);
  }
}
