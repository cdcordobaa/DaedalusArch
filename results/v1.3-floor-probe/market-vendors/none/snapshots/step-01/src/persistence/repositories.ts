import { Booking, CardSale, MarketDay, Pitch, ReaderLink, Vendor } from '../business/models';
import { bookings, cardSales, marketDays, pitches, readerLinks, vendors } from './store';

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
  forVendor: (vendorId: string) => bookings.where((b) => b.vendorId === vendorId),
};

export const readerLinkRepository = {
  save: (l: ReaderLink) => readerLinks.upsert(l),
  find: (marketDayId: string, readerId: string) => readerLinks.get(`${marketDayId}|${readerId}`),
};

export const cardSaleRepository = {
  save: (s: CardSale) => cardSales.upsert(s),
  forVendorAndDay: (vendorId: string, marketDayId: string) =>
    cardSales.where((s) => s.vendorId === vendorId && s.marketDayId === marketDayId),
  forVendor: (vendorId: string) => cardSales.where((s) => s.vendorId === vendorId),
};
