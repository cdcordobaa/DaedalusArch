import { AuditEntry, Booking, CardSale, FeeSchedule, MarketDay, MerchantLink, Pitch, ReaderLink, Settlement, Vendor } from "../domain/entities";
import {
  AuditLogRepository,
  BookingRepository,
  CardSaleRepository,
  FeeScheduleRepository,
  MarketDayRepository,
  MerchantLinkRepository,
  PitchRepository,
  ReaderLinkRepository,
  SettlementRepository,
  UnitOfWork,
  VendorBalanceRepository,
  VendorRepository,
} from "../domain/repositories";

/** A store that can capture its state and hand back a function that restores it. */
export interface Snapshottable {
  snapshot(): () => void;
}

const copy = <T>(v: T): T => structuredClone(v);

export class InMemoryMarketDays implements MarketDayRepository, Snapshottable {
  private items = new Map<string, MarketDay>();
  snapshot() { const saved = new Map(this.items); return () => { this.items = saved; }; }
  add(day: MarketDay) { this.items.set(day.id, day); }
  get(id: string) { return this.items.get(id); }
  getByDate(date: string) { return [...this.items.values()].find((d) => d.date === date); }
  update(day: MarketDay) { this.items.set(day.id, day); }
  list() { return [...this.items.values()]; }
}

export class InMemoryPitches implements PitchRepository, Snapshottable {
  private items = new Map<string, Pitch>();
  snapshot() { const saved = new Map(this.items); return () => { this.items = saved; }; }
  add(pitch: Pitch) { this.items.set(pitch.id, pitch); }
  get(id: string) { return this.items.get(id); }
  getByNumber(number: number) { return [...this.items.values()].find((p) => p.number === number); }
  list() { return [...this.items.values()]; }
}

export class InMemoryVendors implements VendorRepository, Snapshottable {
  private items = new Map<string, Vendor>();
  snapshot() { const saved = new Map(this.items); return () => { this.items = saved; }; }
  add(vendor: Vendor) { this.items.set(vendor.id, vendor); }
  get(id: string) { return this.items.get(id); }
  update(vendor: Vendor) { this.items.set(vendor.id, vendor); }
  list() { return [...this.items.values()]; }
}

export class InMemoryBookings implements BookingRepository, Snapshottable {
  private items: Booking[] = [];
  snapshot() { const saved = [...this.items]; return () => { this.items = saved; }; }
  add(booking: Booking) { this.items.push(booking); }
  get(id: string) { return this.items.find((b) => b.id === id); }
  update(booking: Booking) {
    const i = this.items.findIndex((b) => b.id === booking.id);
    if (i >= 0) this.items[i] = booking;
  }
  findByDayAndPitch(marketDayId: string, pitchId: string) {
    return this.items.find((b) => b.marketDayId === marketDayId && b.pitchId === pitchId && b.status === "active");
  }
  findByDayAndVendor(marketDayId: string, vendorId: string) {
    return this.items.find((b) => b.marketDayId === marketDayId && b.vendorId === vendorId && b.status === "active");
  }
  listByDay(marketDayId: string) { return this.items.filter((b) => b.marketDayId === marketDayId); }
  listByVendor(vendorId: string) { return this.items.filter((b) => b.vendorId === vendorId); }
}

export class InMemoryReaderLinks implements ReaderLinkRepository, Snapshottable {
  private items = new Map<string, ReaderLink>();
  snapshot() { const saved = new Map(this.items); return () => { this.items = saved; }; }
  set(link: ReaderLink) { this.items.set(`${link.marketDayId}|${link.readerId}`, link); }
  find(marketDayId: string, readerId: string) { return this.items.get(`${marketDayId}|${readerId}`); }
  findByVendor(marketDayId: string, vendorId: string) {
    return [...this.items.values()].find((l) => l.marketDayId === marketDayId && l.vendorId === vendorId);
  }
}

export class InMemoryMerchantLinks implements MerchantLinkRepository, Snapshottable {
  private items = new Map<string, MerchantLink>();
  snapshot() { const saved = new Map(this.items); return () => { this.items = saved; }; }
  set(link: MerchantLink) { this.items.set(`${link.marketDayId}|${link.merchantId}`, link); }
  find(marketDayId: string, merchantId: string) { return this.items.get(`${marketDayId}|${merchantId}`); }
  findByVendor(marketDayId: string, vendorId: string) {
    return [...this.items.values()].find((l) => l.marketDayId === marketDayId && l.vendorId === vendorId);
  }
}

export class InMemoryCardSales implements CardSaleRepository, Snapshottable {
  private items: CardSale[] = [];
  snapshot() { const saved = [...this.items]; return () => { this.items = saved; }; }
  add(sale: CardSale) { this.items.push(sale); }
  findByExternalId(provider: string, externalId: string) {
    return this.items.find((s) => s.provider === provider && s.externalId === externalId);
  }
  listByVendor(vendorId: string) { return this.items.filter((s) => s.vendorId === vendorId); }
}

export class InMemoryFeeSchedule implements FeeScheduleRepository, Snapshottable {
  private schedule: FeeSchedule = { small: 20, medium: 30, large: 45, powerSurcharge: 10 };
  snapshot() { const saved = this.schedule; return () => { this.schedule = saved; }; }
  get() { return { ...this.schedule }; }
  set(schedule: FeeSchedule) { this.schedule = { ...schedule }; }
}

export class InMemorySettlements implements SettlementRepository, Snapshottable {
  private items: Settlement[] = [];
  snapshot() { const saved = [...this.items]; return () => { this.items = saved; }; }
  add(settlement: Settlement) { this.items.push(settlement); }
  listByDay(marketDayId: string) { return this.items.filter((s) => s.marketDayId === marketDayId); }
  listByVendor(vendorId: string) { return this.items.filter((s) => s.vendorId === vendorId); }
}

export class InMemoryVendorBalances implements VendorBalanceRepository, Snapshottable {
  private items = new Map<string, number>();
  snapshot() { const saved = new Map(this.items); return () => { this.items = saved; }; }
  get(vendorId: string) { return this.items.get(vendorId) ?? 0; }
  set(vendorId: string, owed: number) { this.items.set(vendorId, owed); }
}

export class InMemoryAuditLog implements AuditLogRepository, Snapshottable {
  private items: AuditEntry[] = [];
  snapshot() { const saved = [...this.items]; return () => { this.items = saved; }; }
  add(entry: AuditEntry) { this.items.push(copy(entry)); }
  listByDay(marketDayId: string) { return this.items.filter((e) => e.marketDayId === marketDayId).map(copy); }
}

/** Snapshots every registered store before the work and restores them all if the work throws. */
export class InMemoryUnitOfWork implements UnitOfWork {
  private depth = 0;
  constructor(private readonly stores: Snapshottable[]) {}
  run<T>(work: () => T): T {
    if (this.depth > 0) return work();
    const restores = this.stores.map((store) => store.snapshot());
    this.depth++;
    try {
      return work();
    } catch (e) {
      for (const restore of restores) restore();
      throw e;
    } finally {
      this.depth--;
    }
  }
}
