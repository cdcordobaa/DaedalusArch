import { Booking, CardSale, MarketDay, Pitch, ReaderLink, Vendor } from '../../domain/entities/market';
import {
  BookingRepository, MarketRepository, ReaderLinkRepository, SaleRepository, VendorRepository,
} from '../../domain/repositories';

export class MemoryMarketRepository implements MarketRepository {
  private readonly d = new Map<string, MarketDay>();
  private readonly p = new Map<string, Pitch>();
  saveDay(x: MarketDay): void { this.d.set(x.id, x); }
  day(id: string): MarketDay | undefined { return this.d.get(id); }
  dayByDate(date: string): MarketDay | undefined { return [...this.d.values()].find((x) => x.date === date); }
  days(): MarketDay[] { return [...this.d.values()]; }
  savePitch(x: Pitch): void { this.p.set(x.id, x); }
  pitch(id: string): Pitch | undefined { return this.p.get(id); }
  pitches(): Pitch[] { return [...this.p.values()]; }
}

export class MemoryVendorRepository implements VendorRepository {
  private readonly m = new Map<string, Vendor>();
  save(v: Vendor): void { this.m.set(v.id, v); }
  get(id: string): Vendor | undefined { return this.m.get(id); }
  list(): Vendor[] { return [...this.m.values()]; }
}

export class MemoryBookingRepository implements BookingRepository {
  private readonly m = new Map<string, Booking>();
  save(b: Booking): void { this.m.set(b.id, b); }
  forDay(id: string): Booking[] { return [...this.m.values()].filter((b) => b.marketDayId === id); }
}

export class MemoryReaderLinkRepository implements ReaderLinkRepository {
  private readonly m = new Map<string, ReaderLink>();
  save(l: ReaderLink): void { this.m.set(`${l.readerId}@${l.marketDayId}`, l); }
  find(readerId: string, dayId: string): ReaderLink | undefined { return this.m.get(`${readerId}@${dayId}`); }
}

export class MemorySaleRepository implements SaleRepository {
  private readonly m: CardSale[] = [];
  save(s: CardSale): void { this.m.push(s); }
  forVendorAndDay(v: string, d: string): CardSale[] { return this.m.filter((s) => s.vendorId === v && s.marketDayId === d); }
}

export class CounterIds {
  private n = 0;
  next(prefix: string): string { this.n++; return `${prefix}_${this.n}`; }
}
