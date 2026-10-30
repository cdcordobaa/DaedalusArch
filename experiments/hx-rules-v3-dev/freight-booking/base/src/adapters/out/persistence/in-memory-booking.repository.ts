import { BookingRepositoryPort } from '../../../application/ports/out/booking-repository.port';
import { Booking } from '../../../domain/booking';

export class InMemoryBookingRepository implements BookingRepositoryPort {
  private readonly rows = new Map<string, Booking>();

  async findById(id: string): Promise<Booking | null> {
    return this.rows.get(id) ?? null;
  }

  async save(booking: Booking): Promise<void> {
    this.rows.set(booking.id, booking);
  }
}
