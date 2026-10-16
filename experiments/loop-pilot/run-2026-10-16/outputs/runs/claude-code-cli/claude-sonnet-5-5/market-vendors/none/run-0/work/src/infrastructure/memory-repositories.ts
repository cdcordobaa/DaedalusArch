import type {
  AuditEntry,
  Booking,
  CardSale,
  FeeSchedule,
  MarketDay,
  MerchantLink,
  Pitch,
  ReaderLink,
  Settlement,
  Vendor,
} from "../domain/entities.js";
import type { Repositories } from "../application/market-service.js";

export function createMemoryRepositories(): Repositories {
  const days = new Map<string, MarketDay>();
  const pitches = new Map<string, Pitch>();
  const vendors = new Map<string, Vendor>();
  const bookings: Booking[] = [];
  const links = new Map<string, ReaderLink>();
  const merchantLinks = new Map<string, MerchantLink>();
  const sales: CardSale[] = [];
  const settlements: Settlement[] = [];
  let schedule: FeeSchedule = { stallFees: { small: 20, medium: 30, large: 45 }, powerSurcharge: 10 };

  const audit: AuditEntry[] = [];
  let depth = 0;

  const refillMap = <K, V>(target: Map<K, V>, from: Map<K, V>): void => {
    target.clear();
    for (const [k, v] of from) target.set(k, v);
  };
  const refillArray = <T>(target: T[], from: T[]): void => {
    target.splice(0, target.length, ...from);
  };
  const snapshot = () =>
    structuredClone({ days, pitches, vendors, bookings, links, merchantLinks, sales, settlements, audit, schedule });
  const restore = (s: ReturnType<typeof snapshot>): void => {
    refillMap(days, s.days);
    refillMap(pitches, s.pitches);
    refillMap(vendors, s.vendors);
    refillMap(links, s.links);
    refillMap(merchantLinks, s.merchantLinks);
    refillArray(bookings, s.bookings);
    refillArray(sales, s.sales);
    refillArray(settlements, s.settlements);
    refillArray(audit, s.audit);
    schedule = s.schedule;
  };

  return {
    transaction: <T>(work: () => T): T => {
      if (depth > 0) return work();
      const saved = snapshot();
      depth++;
      try {
        return work();
      } catch (e) {
        restore(saved);
        throw e;
      } finally {
        depth--;
      }
    },
    audit: {
      add: (e) => void audit.push(e),
      list: () => [...audit],
      listByDay: (d) => audit.filter((e) => e.marketDayId === d),
    },
    days: {
      add: (d) => void days.set(d.id, d),
      save: (d) => void days.set(d.id, d),
      get: (id) => days.get(id),
      findByDate: (date) => [...days.values()].find((d) => d.date === date),
      list: () => [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    },
    pitches: {
      add: (p) => void pitches.set(p.id, p),
      get: (id) => pitches.get(id),
      findByNumber: (n) => [...pitches.values()].find((p) => p.number === n),
      list: () => [...pitches.values()].sort((a, b) => a.number - b.number),
    },
    vendors: {
      add: (v) => void vendors.set(v.id, v),
      save: (v) => void vendors.set(v.id, v),
      get: (id) => vendors.get(id),
      list: () => [...vendors.values()],
    },
    bookings: {
      add: (b) => void bookings.push(b),
      save: (b) => {
        const i = bookings.findIndex((x) => x.id === b.id);
        if (i >= 0) bookings[i] = b;
      },
      get: (id) => bookings.find((b) => b.id === id),
      findByDayAndPitch: (d, p) =>
        bookings.find((b) => b.status === "active" && b.marketDayId === d && b.pitchId === p),
      findByDayAndVendor: (d, v) =>
        bookings.find((b) => b.status === "active" && b.marketDayId === d && b.vendorId === v),
      listByDay: (d) => bookings.filter((b) => b.marketDayId === d),
    },
    links: {
      add: (l) => void links.set(`${l.marketDayId}|${l.readerId}`, l),
      find: (d, r) => links.get(`${d}|${r}`),
      findByVendor: (d, v) => [...links.values()].find((l) => l.marketDayId === d && l.vendorId === v),
    },
    merchantLinks: {
      add: (l) => void merchantLinks.set(`${l.marketDayId}|${l.merchantId}`, l),
      find: (d, m) => merchantLinks.get(`${d}|${m}`),
      findByVendor: (d, v) => [...merchantLinks.values()].find((l) => l.marketDayId === d && l.vendorId === v),
    },
    sales: {
      add: (s) => void sales.push(s),
      findByExternal: (p, id) => sales.find((s) => s.provider === p && s.externalId === id),
      listByVendor: (v) => sales.filter((s) => s.vendorId === v),
    },
    fees: {
      get: () => schedule,
      set: (s) => void (schedule = s),
    },
    settlements: {
      add: (s) => void settlements.push(s),
      findByDay: (d) => settlements.find((s) => s.marketDayId === d),
      list: () => [...settlements],
    },
  };
}
