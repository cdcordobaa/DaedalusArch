import { Booking, CardSale, FeeSchedule, MarketDay, MerchantLink, Pitch, ReaderLink, Settlement, Vendor } from './models';

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
export const settlements = new Table<Settlement>((s) => `${s.marketDayId}|${s.vendorId}`);
export const balances = new Map<string, number>(); // vendorId -> amount still owed to the market
export const feeSchedule: FeeSchedule = {
  perSize: { small: 20, medium: 30, large: 45 },
  powerSurcharge: 8,
  defaultCommissionRate: 0.05,
};
export const merchantLinks = new Table<MerchantLink>((l) => `${l.marketDayId}|${l.merchantId}`);
export const pollState = { tillwaveCursor: undefined as string | undefined };
