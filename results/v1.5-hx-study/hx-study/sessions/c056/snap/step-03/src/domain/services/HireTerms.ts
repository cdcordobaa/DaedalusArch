import { WardrobeError } from '../errors/WardrobeError';

/** How long a costume may be lent, and what it costs. */
export class HireTerms {
  price(days: number, dayRate: number): number {
    if (!Number.isInteger(days) || days < 1 || days > 30) throw new WardrobeError('a costume is lent for 1 to 30 days');
    return days * dayRate;
  }

  /** Late fee: 6 euros per day returned after from + days. */
  lateFee(from: string, days: number, returnedOn: string): number {
    const ms = (d: string): number => Date.parse(d + 'T00:00:00Z');
    const late = Math.round((ms(returnedOn) - ms(from)) / 86400000) - days;
    return late > 0 ? late * 6 : 0;
  }

  day(day: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new WardrobeError('a day is written YYYY-MM-DD');
    return day;
  }
}
