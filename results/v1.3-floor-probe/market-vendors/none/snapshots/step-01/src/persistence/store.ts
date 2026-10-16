import { Booking, CardSale, MarketDay, Pitch, ReaderLink, Vendor } from '../business/models';

/** In-memory tables. */
export class Table<T> {
  private readonly rows = new Map<string, T>();
  constructor(private readonly keyOf: (row: T) => string) {}
  upsert(row: T): T {
    this.rows.set(this.keyOf(row), row);
    return row;
  }
  get(key: string): T | undefined {
    return this.rows.get(key);
  }
  delete(key: string): void {
    this.rows.delete(key);
  }
  where(pred: (row: T) => boolean): T[] {
    return [...this.rows.values()].filter(pred);
  }
  all(): T[] {
    return [...this.rows.values()];
  }
}

export const marketDays = new Table<MarketDay>((d) => d.id);
export const pitches = new Table<Pitch>((p) => String(p.number));
export const vendors = new Table<Vendor>((v) => v.id);
export const bookings = new Table<Booking>((b) => b.id);
export const readerLinks = new Table<ReaderLink>((l) => `${l.marketDayId}|${l.readerId}`);
export const cardSales = new Table<CardSale>((s) => s.id);
