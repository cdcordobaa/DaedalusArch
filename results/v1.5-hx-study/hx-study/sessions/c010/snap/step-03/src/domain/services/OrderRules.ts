import { BakeryError } from '../errors/BakeryError';

/** How much flour one order may be, and how a delivery day is written. */
export class OrderRules {
  bags(n: number): number {
    if (!Number.isInteger(n) || n < 1 || n > 60) throw new BakeryError('an order is 1 to 60 bags');
    return n;
  }

  day(day: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BakeryError('a delivery day is written YYYY-MM-DD');
    const d = new Date(`${day}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== day) throw new BakeryError('a delivery day is written YYYY-MM-DD');
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) throw new BakeryError('We take deliveries Monday to Friday only.');
    return day;
  }
}
