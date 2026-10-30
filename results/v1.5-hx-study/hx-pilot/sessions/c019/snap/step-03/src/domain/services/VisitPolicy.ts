import { BookingRefused } from '../errors/BookingRefused';

const ADULT_EUROS = 12;
const CHILD_EUROS = 6;
const LARGEST_PARTY = 8;
const LATE_EVENING_HOUR = 22;

/** Who may book an evening online, and what it costs. */
export class VisitPolicy {
  party(adults: number, children: number): { adults: number; children: number } {
    if (!Number.isInteger(adults) || adults < 1) throw new BookingRefused('a booking needs at least one adult');
    if (!Number.isInteger(children) || children < 0) throw new BookingRefused('children must be a whole number');
    if (adults + children > LARGEST_PARTY) throw new BookingRefused('parties of more than ' + String(LARGEST_PARTY) + ' book by email');
    return { adults, children };
  }

  evening(raw: string): string {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) throw new BookingRefused('an evening is written YYYY-MM-DDTHH:MM');
    return raw;
  }

  /** Evenings starting at 22:00 or later are for adults only. */
  checkAttendance(evening: string, children: number): void {
    const hour = Number(evening.slice(11, 13));
    if (hour >= LATE_EVENING_HOUR && children > 0) throw new BookingRefused('Late evenings are for adults only.');
  }

  price(adults: number, children: number): number {
    return adults * ADULT_EUROS + children * CHILD_EUROS;
  }
}
