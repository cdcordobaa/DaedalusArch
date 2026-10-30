import { WardrobeError } from '../errors/WardrobeError';

/** How long a costume may be lent, and what it costs. */
export class HireTerms {
  price(days: number, dayRate: number): number {
    if (!Number.isInteger(days) || days < 1 || days > 30) throw new WardrobeError('a costume is lent for 1 to 30 days');
    return days * dayRate;
  }

  static readonly LATE_FEE_PER_DAY = 6;

  /** The fee for a return after the hire's last day. */
  lateFee(from: string, days: number, returnedOn: string): number {
    const late = dayNumber(returnedOn) - (dayNumber(from) + days);
    return late > 0 ? late * HireTerms.LATE_FEE_PER_DAY : 0;
  }

  day(day: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new WardrobeError('a day is written YYYY-MM-DD');
    return day;
  }
}

function dayNumber(day: string): number {
  return Math.round(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86400000);
}
