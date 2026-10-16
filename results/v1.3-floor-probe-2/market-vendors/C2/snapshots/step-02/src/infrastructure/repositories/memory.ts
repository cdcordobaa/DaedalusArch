import { randomUUID } from 'node:crypto';
import { MarketDay } from '../../domain/entities/market-day';
import { Booking } from '../../domain/entities/booking';
import { CardSale, ReaderAssignment } from '../../domain/entities/card-sale';
import { FeeTable } from '../../domain/entities/fees';
import { BalanceRepo, BookingRepo, FeeRepo, Ids, MarketDayRepo, ReaderRepo, Repo, SaleRepo } from '../../application/interfaces/repositories';

export class MemoryRepo<T extends { id: string }> implements Repo<T> {
  protected items = new Map<string, T>();
  save(x: T): void { this.items.set(x.id, x); }
  findById(id: string): T | undefined { return this.items.get(id); }
  all(): T[] { return [...this.items.values()]; }
}

export class MemoryMarketDayRepo extends MemoryRepo<MarketDay> implements MarketDayRepo {
  findByDate(date: string): MarketDay | undefined { return this.all().find((d) => d.date === date); }
}

export class MemoryBookingRepo extends MemoryRepo<Booking> implements BookingRepo {
  forDay(id: string): Booking[] { return this.all().filter((b) => b.marketDayId === id); }
}

export class MemorySaleRepo extends MemoryRepo<CardSale> implements SaleRepo {
  forVendorOnDay(v: string, d: string): CardSale[] { return this.all().filter((s) => s.vendorId === v && s.marketDayId === d); }
  forDay(d: string): CardSale[] { return this.all().filter((s) => s.marketDayId === d); }
}

export class MemoryReaderRepo implements ReaderRepo {
  private m = new Map<string, ReaderAssignment>();
  assign(a: ReaderAssignment): void { this.m.set(`${a.marketDayId}/${a.readerId}`, a); }
  find(r: string, d: string): ReaderAssignment | undefined { return this.m.get(`${d}/${r}`); }
}

export class MemoryFeeRepo implements FeeRepo {
  private t = new FeeTable();
  get(): FeeTable { return this.t; }
  save(t: FeeTable): void { this.t = t; }
}

export class MemoryBalanceRepo implements BalanceRepo {
  private m = new Map<string, number>();
  owed(v: string): number { return this.m.get(v) ?? 0; }
  set(v: string, owed: number): void { this.m.set(v, owed); }
}

export const uuids: Ids = { create: () => randomUUID() };
