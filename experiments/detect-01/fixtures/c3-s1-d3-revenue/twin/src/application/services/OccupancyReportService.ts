import type { NightRevenueView } from '../ports/in/NightRevenueView';
import type { BookingRepository } from '../ports/out/BookingRepository';

const DAY_MS = 86_400_000;

export class OccupancyReportService {
  constructor(private readonly bookings: BookingRepository) {}

  async revenuePerNight(from: Date, nights: number): Promise<NightRevenueView[]> {
    const firstDay = Math.floor(from.getTime() / DAY_MS);
    const perNight: number[] = Array.from({ length: nights }, () => 0);
    for (const booking of await this.bookings.findActive()) {
      const stayStart = Math.floor(booking.stay.checkIn.getTime() / DAY_MS);
      booking.nightlyShares().forEach((share, i) => {
        const slot = stayStart + i - firstDay;
        if (slot >= 0 && slot < nights) perNight[slot]! += share.cents;
      });
    }
    return perNight.map((revenueCents, i) => ({ date: new Date((firstDay + i) * DAY_MS).toISOString().slice(0, 10), revenueCents }));
  }
}
