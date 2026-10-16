import { Booking, CardSale, MarketDay, Pitch, ReaderLink, Vendor } from '../../domain/entities/market';
import { FeeSchedule, Settlement } from '../../domain/entities/fees';
import {
  BookingRepository, FeeRepository, MarketRepository, ReaderLinkRepository, SaleRepository, SettlementRepository,
  VendorRepository,
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
  get(id: string): Booking | undefined { return this.m.get(id); }
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
  forDay(d: string): CardSale[] { return this.m.filter((s) => s.marketDayId === d); }
}

export class MemoryFeeRepository implements FeeRepository {
  private s: FeeSchedule = { stallFee: { small: 20, medium: 30, large: 45 }, powerSurcharge: 10, defaultCommissionRate: 0.05 };
  private readonly rates = new Map<string, number>();
  schedule(): FeeSchedule { return this.s; }
  saveSchedule(s: FeeSchedule): void { this.s = s; }
  vendorRate(v: string): number | undefined { return this.rates.get(v); }
  setVendorRate(v: string, r: number): void { this.rates.set(v, r); }
}

export class MemorySettlementRepository implements SettlementRepository {
  private readonly m = new Map<string, Settlement>();
  private readonly owed = new Map<string, number>();
  save(s: Settlement): void { this.m.set(s.marketDayId, s); }
  get(d: string): Settlement | undefined { return this.m.get(d); }
  balance(v: string): number { return this.owed.get(v) ?? 0; }
  setBalance(v: string, owed: number): void { this.owed.set(v, owed); }
}

export class CounterIds {
  private n = 0;
  next(prefix: string): string { this.n++; return `${prefix}_${this.n}`; }
}
