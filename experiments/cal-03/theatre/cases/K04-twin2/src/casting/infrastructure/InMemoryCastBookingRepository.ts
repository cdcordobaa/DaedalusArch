import { CastBooking } from '../domain/cast-booking/CastBooking';
import { CastBookingRepository } from '../domain/cast-booking/CastBookingRepository';

export class InMemoryCastBookingRepository implements CastBookingRepository {
  private readonly rows = new Map<string, CastBooking>();

  async findById(id: string): Promise<CastBooking | undefined> {
    return this.rows.get(id);
  }

  async findByProduction(productionId: string): Promise<CastBooking[]> {
    return [...this.rows.values()].filter((booking) => booking.productionId === productionId);
  }

  async save(booking: CastBooking): Promise<void> {
    this.rows.set(booking.id, booking);
  }
}
