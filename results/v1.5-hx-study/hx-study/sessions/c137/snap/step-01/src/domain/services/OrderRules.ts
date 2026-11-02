import { BakeryError } from '../errors/BakeryError';
import type { Flour } from '../model/Flour';

/** How much flour one order may be, and how a delivery day is written. */
export class OrderRules {
  bags(n: number): number {
    if (!Number.isInteger(n) || n < 1 || n > 60) throw new BakeryError('an order is 1 to 60 bags');
    return n;
  }

  /** The sku of the cheapest other flour of the same grade with enough bags in stock, or null. */
  alternative(flours: readonly Flour[], sku: string, bags: number): string | null {
    const wanted = flours.find((f) => f.sku === sku);
    if (!wanted) return null;
    const options = flours
      .filter((f) => f.sku !== sku && f.grade === wanted.grade && f.bagsInStock >= bags)
      .sort((a, b) => a.pricePerBag - b.pricePerBag || a.sku.localeCompare(b.sku));
    return options.length > 0 ? options[0].sku : null;
  }

  day(day: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BakeryError('a delivery day is written YYYY-MM-DD');
    return day;
  }
}
