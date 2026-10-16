import { randomUUID } from 'node:crypto';
import { MarketDay } from '../../domain/entities/market-day';
import { Booking } from '../../domain/entities/booking';
import { CardSale, MerchantAssignment, ReaderAssignment } from '../../domain/entities/card-sale';
import { FeeTable } from '../../domain/entities/fees';
import { AuditRecord } from '../../domain/entities/audit-record';
import { AuditRepo, BalanceRepo, BookingRepo, FeeRepo, Ids, MarketDayRepo, MerchantRepo, ReaderRepo, Repo, SaleRepo, UnitOfWork } from '../../application/interfaces/repositories';

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
  forVendor(id: string): Booking[] { return this.all().filter((b) => b.vendorId === id); }
}

export class MemorySaleRepo extends MemoryRepo<CardSale> implements SaleRepo {
  forVendorOnDay(v: string, d: string): CardSale[] { return this.all().filter((s) => s.vendorId === v && s.marketDayId === d); }
  forDay(d: string): CardSale[] { return this.all().filter((s) => s.marketDayId === d); }
  findByProviderId(p: string, id: string): CardSale | undefined { return this.all().find((s) => s.provider === p && s.providerSaleId === id); }
}

export class MemoryReaderRepo implements ReaderRepo {
  private m = new Map<string, ReaderAssignment>();
  assign(a: ReaderAssignment): void { this.m.set(`${a.marketDayId}/${a.readerId}`, a); }
  find(r: string, d: string): ReaderAssignment | undefined { return this.m.get(`${d}/${r}`); }
}

export class MemoryMerchantRepo implements MerchantRepo {
  private m = new Map<string, MerchantAssignment>();
  assign(a: MerchantAssignment): void { this.m.set(a.merchantId, a); }
  find(id: string): MerchantAssignment | undefined { return this.m.get(id); }
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

export class MemoryAuditRepo implements AuditRepo {
  private rows: AuditRecord[] = [];
  add(r: AuditRecord): void { this.rows.push(r); }
  forMarketDay(id: string): AuditRecord[] { return this.rows.filter((r) => r.marketDayId === id); }
}

/**
 * In-memory all-or-nothing: snapshots each store's own fields and the objects they hold before fn, restores on throw.
 * Entities are mutable (e.g. Booking.cancel), so every stored object is shallow-copied with its prototype.
 */
export class MemoryUnitOfWork implements UnitOfWork {
  private active = false;
  constructor(private stores: object[]) {}

  atomically<T>(fn: () => T): T {
    if (this.active) return fn();
    const snaps = this.stores.map((s) => Object.entries(s).map(([k, v]) => [k, copy(v)] as const));
    this.active = true;
    try {
      return fn();
    } catch (e) {
      this.stores.forEach((s, i) => { for (const [k, v] of snaps[i] ?? []) (s as Record<string, unknown>)[k] = v; });
      throw e;
    } finally {
      this.active = false;
    }
  }
}

function copyObj<T>(o: T): T {
  return o !== null && typeof o === 'object' ? Object.assign(Object.create(Object.getPrototypeOf(o) as object) as object, o) as T : o;
}

function copy(v: unknown): unknown {
  if (v instanceof Map) return new Map([...v.entries()].map(([k, x]) => [k, copyObj(x)]));
  if (Array.isArray(v)) return v.map(copyObj);
  return copyObj(v);
}

export const uuids: Ids = { create: () => randomUUID() };
