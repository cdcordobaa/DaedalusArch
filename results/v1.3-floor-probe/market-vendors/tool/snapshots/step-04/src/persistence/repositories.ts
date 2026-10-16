import { AuditEntry, Booking, CardSale, FeeSchedule, MarketDay, MerchantLink, Pitch, ReaderLink, Settlement, Vendor } from './models';
import {
  auditLog,
  balances,
  bookings,
  cardSales,
  feeSchedule,
  marketDays,
  merchantLinks,
  pitches,
  pollState,
  readerLinks,
  settlements,
  vendors,
} from './store';

export const marketDayRepository = {
  save: (d: MarketDay) => marketDays.upsert(d),
  find: (id: string) => marketDays.get(id),
  findByDate: (date: string) => marketDays.where((d) => d.date === date)[0],
  all: () => marketDays.all().sort((a, b) => a.date.localeCompare(b.date)),
};

export const pitchRepository = {
  save: (p: Pitch) => pitches.upsert(p),
  find: (n: number) => pitches.get(String(n)),
  all: () => pitches.all().sort((a, b) => a.number - b.number),
};

export const vendorRepository = {
  save: (v: Vendor) => vendors.upsert(v),
  find: (id: string) => vendors.get(id),
  all: () => vendors.all(),
};

export const bookingRepository = {
  save: (b: Booking) => bookings.upsert(b),
  find: (id: string) => bookings.get(id),
  delete: (id: string) => bookings.delete(id),
  forDay: (marketDayId: string) => bookings.where((b) => b.marketDayId === marketDayId),
  activeForDay: (marketDayId: string) => bookings.where((b) => b.marketDayId === marketDayId && !b.cancelledAt),
  forVendor: (vendorId: string) => bookings.where((b) => b.vendorId === vendorId),
};

export const readerLinkRepository = {
  save: (l: ReaderLink) => readerLinks.upsert(l),
  find: (marketDayId: string, readerId: string) => readerLinks.get(`${marketDayId}|${readerId}`),
  forVendorAndDay: (vendorId: string, marketDayId: string) =>
    readerLinks.where((l) => l.vendorId === vendorId && l.marketDayId === marketDayId),
};

export const merchantLinkRepository = {
  save: (l: MerchantLink) => merchantLinks.upsert(l),
  find: (marketDayId: string, merchantId: string) => merchantLinks.get(`${marketDayId}|${merchantId}`),
  forVendorAndDay: (vendorId: string, marketDayId: string) =>
    merchantLinks.where((l) => l.vendorId === vendorId && l.marketDayId === marketDayId),
};

export const pollStateRepository = {
  getCursor: () => pollState.tillwaveCursor,
  setCursor: (c: string) => {
    pollState.tillwaveCursor = c;
  },
};

export const cardSaleRepository = {
  save: (s: CardSale) => cardSales.upsert(s),
  forVendorAndDay: (vendorId: string, marketDayId: string) =>
    cardSales.where((s) => s.vendorId === vendorId && s.marketDayId === marketDayId),
  forVendor: (vendorId: string) => cardSales.where((s) => s.vendorId === vendorId),
  forDay: (marketDayId: string) => cardSales.where((s) => s.marketDayId === marketDayId),
  findByExternalId: (provider: string, externalId: string) =>
    cardSales.where((s) => s.provider === provider && s.externalId === externalId)[0],
};

export const settlementRepository = {
  save: (s: Settlement) => settlements.upsert(s),
  forDay: (marketDayId: string) => settlements.where((s) => s.marketDayId === marketDayId),
  forVendor: (vendorId: string) => settlements.where((s) => s.vendorId === vendorId),
};

export const balanceRepository = {
  owed: (vendorId: string) => balances.get(vendorId) ?? 0,
  setOwed: (vendorId: string, amount: number) => balances.set(vendorId, amount),
};

export const feeRepository = {
  get: (): FeeSchedule => feeSchedule,
  update: (patch: Partial<FeeSchedule>): FeeSchedule => Object.assign(feeSchedule, patch),
};

export const auditRepository = {
  append: (e: AuditEntry) => auditLog.upsert(e),
  forMarketDay: (marketDayId: string) => auditLog.where((e) => e.marketDayId === marketDayId).sort((a, b) => a.at.localeCompare(b.at)),
};
