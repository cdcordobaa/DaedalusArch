import { Booking, CardSale, MarketDay, MerchantLink, Pitch, ReaderLink, Vendor } from '../../domain/entities/market';
import { FeeSchedule, Settlement } from '../../domain/entities/fees';
import { AuditEntry } from '../../domain/entities/audit';
import { Transaction } from '../../application/ports';
import {
  AuditRepository, BookingRepository, FeeRepository, MarketRepository, ReaderLinkRepository, SaleRepository, SettlementRepository,
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
  forVendor(id: string): Booking[] { return [...this.m.values()].filter((b) => b.vendorId === id); }
}

export class MemoryReaderLinkRepository implements ReaderLinkRepository {
  private readonly m = new Map<string, ReaderLink>();
  save(l: ReaderLink): void { this.m.set(`${l.readerId}@${l.marketDayId}`, l); }
  find(readerId: string, dayId: string): ReaderLink | undefined { return this.m.get(`${readerId}@${dayId}`); }
  private readonly merchants = new Map<string, MerchantLink>();
  saveMerchant(l: MerchantLink): void { this.merchants.set(l.merchantId, l); }
  merchant(id: string): MerchantLink | undefined { return this.merchants.get(id); }
}

export class MemorySaleRepository implements SaleRepository {
  private readonly m: CardSale[] = [];
  save(s: CardSale): void { this.m.push(s); }
  forVendorAndDay(v: string, d: string): CardSale[] { return this.m.filter((s) => s.vendorId === v && s.marketDayId === d); }
  forDay(d: string): CardSale[] { return this.m.filter((s) => s.marketDayId === d); }
  byExternalId(p: string, x: string): CardSale | undefined { return this.m.find((s) => s.provider === p && s.externalId === x); }
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
  all(): Settlement[] { return [...this.m.values()]; }
}

export class CounterIds {
  private n = 0;
  next(prefix: string): string { this.n++; return `${prefix}_${this.n}`; }
}

export class MemoryAuditRepository implements AuditRepository {
  private readonly m: AuditEntry[] = [];
  append(e: AuditEntry): void { this.m.push(e); }
  forDay(d: string): AuditEntry[] { return this.m.filter((e) => e.marketDayId === d); }
}

/**
 * All-or-nothing for the in-memory stores: snapshots every repository object's fields (deep-cloned) before the work and
 * puts them back if it throws.
 */
export class MemoryTransaction implements Transaction {
  private depth = 0;
  constructor(private readonly stores: object[]) {}
  run<T>(work: () => T): T {
    if (this.depth > 0) return work();
    const snaps = this.stores.map((s) => structuredClone(Object.entries(s)));
    this.depth++;
    try {
      return work();
    } catch (e) {
      this.stores.forEach((s, i) => { for (const [k, v] of snaps[i] ?? []) (s as Record<string, unknown>)[k] = v; });
      throw e;
    } finally {
      this.depth--;
    }
  }
}
