import { Booking, Fees, MarketDay, MerchantLink, ReaderLink, Sale, Settlement } from '../domain/model';
import { Balances, Bookings, FeeSettings, MarketDays, MerchantLinks, ReaderLinks, Sales, Settlements, Store } from '../domain/repositories';
import { IdSource } from '../application/market-service';

export class MemoryStore<T extends { id: string }> implements Store<T> {
  protected readonly rows = new Map<string, T>();
  add(x: T): void { this.rows.set(x.id, x); }
  byId(id: string): T | undefined { return this.rows.get(id); }
  list(): T[] { return [...this.rows.values()]; }
}

export class MemoryMarketDays extends MemoryStore<MarketDay> implements MarketDays {
  byDate(date: string): MarketDay | undefined { return this.list().find((d) => d.date === date); }
}
export class MemoryBookings extends MemoryStore<Booking> implements Bookings {
  onDay(dayId: string): Booking[] { return this.list().filter((b) => b.dayId === dayId); }
}
export class MemorySales extends MemoryStore<Sale> implements Sales {
  of(vendorId: string, dayId: string): Sale[] { return this.list().filter((s) => s.vendorId === vendorId && s.dayId === dayId); }
  onDay(dayId: string): Sale[] { return this.list().filter((s) => s.dayId === dayId); }
  byRef(p: string, ref: string): Sale | undefined { return this.list().find((s) => s.provider === p && s.ref === ref); }
}
export class MemoryReaderLinks implements ReaderLinks {
  private readonly m = new Map<string, ReaderLink>();
  link(l: ReaderLink): void { this.m.set(`${l.dayId}:${l.readerId}`, l); }
  find(readerId: string, dayId: string): ReaderLink | undefined { return this.m.get(`${dayId}:${readerId}`); }
}

export class MemoryMerchantLinks implements MerchantLinks {
  private readonly m = new Map<string, MerchantLink>();
  link(l: MerchantLink): void { this.m.set(l.merchantId, l); }
  find(id: string): MerchantLink | undefined { return this.m.get(id); }
}

export class MemorySettlements extends MemoryStore<Settlement> implements Settlements {
  ofDay(dayId: string): Settlement | undefined { return this.list().find((s) => s.dayId === dayId); }
}
export class MemoryFeeSettings implements FeeSettings {
  private f: Fees = { stall: { small: 20, medium: 30, large: 45 }, powerSurcharge: 10, commission: 0.05, commissionByVendor: {} };
  get(): Fees { return this.f; }
  put(f: Fees): void { this.f = f; }
}
export class MemoryBalances implements Balances {
  private readonly m = new Map<string, number>();
  owed(v: string): number { return this.m.get(v) ?? 0; }
  setOwed(v: string, a: number): void { this.m.set(v, a); }
}

export class Counter implements IdSource {
  private n = 0;
  next(): string { return String(++this.n); }
}
