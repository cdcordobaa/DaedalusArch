import type { NightRevenueView } from '../ports/in/NightRevenueView';
import type { BookingRepository } from '../ports/out/BookingRepository';

const DAY_MS = 86_400_000;

export class OccupancyReportService {
  constructor(private readonly bookings: BookingRepository) {}

  async revenuePerNight(from: Date, nights: number): Promise<NightRevenueView[]> {
    const firstDay = Math.floor(from.getTime() / DAY_MS);
    const perNight: number[] = Array.from({ length: nights }, () => 0);
    for (const booking of await this.bookings.findActive()) {
      const stayNights = booking.stay.nights();
      const stayStart = Math.floor(booking.stay.checkIn.getTime() / DAY_MS);
      // Spread the total evenly in whole cents; the first `extra` nights carry the odd cents so the parts sum exactly.
      const base = Math.floor(booking.total.cents / stayNights);
      const extra = booking.total.cents - base * stayNights;
      for (let day = Math.max(stayStart, firstDay); day < Math.min(stayStart + stayNights, firstDay + nights); day++) {
        perNight[day - firstDay]! += base + (day - stayStart < extra ? 1 : 0);
      }
    }
    return perNight.map((revenueCents, i) => ({ date: new Date((firstDay + i) * DAY_MS).toISOString().slice(0, 10), revenueCents }));
  }
}
