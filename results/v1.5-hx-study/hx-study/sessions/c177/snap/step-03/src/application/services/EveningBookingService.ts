import { BookingRefused } from '../../domain/errors/BookingRefused';
import type { Booking } from '../../domain/model/Booking';
import type { Evening } from '../../domain/model/Evening';
import { VisitPolicy } from '../../domain/services/VisitPolicy';
import type { BookEvenings } from '../ports/in/BookEvenings';
import type { SeatPlanner } from '../ports/out/SeatPlanner';

export class EveningBookingService implements BookEvenings {
  constructor(
    private readonly seats: SeatPlanner,
    private readonly policy: VisitPolicy = new VisitPolicy(),
  ) {}

  async eveningsIn(month: string): Promise<Evening[]> {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BookingRefused('a month is written YYYY-MM');
    const all = await this.seats.month(month);
    return all.slice().sort((a, b) => a.date.localeCompare(b.date));
  }

  async book(rawEvening: string, rawAdults: number, rawChildren: number): Promise<Booking> {
    const evening = this.policy.evening(rawEvening);
    const { adults, children } = this.policy.party(rawAdults, rawChildren);
    this.policy.childrenAllowed(evening, children);
    const bookingRef = await this.seats.reserve(evening, adults + children, children);
    return { bookingRef, evening, adults, children, priceEuros: this.policy.price(adults, children) };
  }
}
