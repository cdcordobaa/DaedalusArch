import { Booking, MarketDay, ReaderLink, Sale } from '../domain/model';
import { Bookings, MarketDays, ReaderLinks, Sales, Store } from '../domain/repositories';
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
}
export class MemoryReaderLinks implements ReaderLinks {
  private readonly m = new Map<string, ReaderLink>();
  link(l: ReaderLink): void { this.m.set(`${l.dayId}:${l.readerId}`, l); }
  find(readerId: string, dayId: string): ReaderLink | undefined { return this.m.get(`${dayId}:${readerId}`); }
}

export class Counter implements IdSource {
  private n = 0;
  next(): string { return String(++this.n); }
}
