import { BookingRepositoryPort } from '../../../application/ports/out/booking-repository.port';
import { TourBooking } from '../../../domain/tour-booking';

export class InMemoryBookingRepository implements BookingRepositoryPort {
  private readonly rows = new Map<string, TourBooking>();

  async findById(id: string): Promise<TourBooking | null> {
    return this.rows.get(id) ?? null;
  }

  async findByRoute(routeCode: string): Promise<TourBooking[]> {
    return [...this.rows.values()].filter((b) => b.routeCode === routeCode);
  }

  async save(booking: TourBooking): Promise<void> {
    this.rows.set(booking.id, booking);
  }
}
