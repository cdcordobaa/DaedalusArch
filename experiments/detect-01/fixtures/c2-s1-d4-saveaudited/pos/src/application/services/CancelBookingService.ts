import { AuditEntry } from '../../domain/model/AuditRecord';
import type { BookingRepository } from '../ports/out/BookingRepository';

export class CancelBookingService {
  constructor(private readonly bookings: BookingRepository) {}

  async cancel(bookingId: string, userId: string): Promise<void> {
    const booking = await this.bookings.findById(bookingId);
    if (booking === undefined) throw new Error(`No booking ${bookingId}`);
    booking.cancel();
    const entry = new AuditEntry(this.bookings.nextAuditId(), booking.id, 'cancelled', userId, new Date());
    await this.bookings.saveAudited(booking, [entry]);
  }
}
