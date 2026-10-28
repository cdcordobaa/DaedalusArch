import { CastBooking } from '../domain/cast-booking/CastBooking';
import { CastBookingRepository } from '../domain/cast-booking/CastBookingRepository';

export class InMemoryCastBookingRepository implements CastBookingRepository {
  private readonly rows = new Map<string, CastBooking>();
  readonly history: Array<{ id: string; status: string }> = [];

  async findById(id: string): Promise<CastBooking | undefined> {
    return this.rows.get(id);
  }

  async save(booking: CastBooking): Promise<void> {
    this.rows.set(booking.id, booking);
    this.history.push({ id: booking.id, status: booking.status });
  }
}
