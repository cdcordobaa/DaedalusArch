import { Booking, CardSale, MarketDay, Pitch, ReaderLink, Vendor } from '../entities/market';

export interface MarketRepository {
  saveDay(d: MarketDay): void;
  day(id: string): MarketDay | undefined;
  dayByDate(date: string): MarketDay | undefined;
  days(): MarketDay[];
  savePitch(p: Pitch): void;
  pitch(id: string): Pitch | undefined;
  pitches(): Pitch[];
}

export interface VendorRepository {
  save(v: Vendor): void;
  get(id: string): Vendor | undefined;
  list(): Vendor[];
}

export interface BookingRepository {
  save(b: Booking): void;
  forDay(marketDayId: string): Booking[];
}

export interface ReaderLinkRepository {
  save(l: ReaderLink): void;
  find(readerId: string, marketDayId: string): ReaderLink | undefined;
}

export interface SaleRepository {
  save(s: CardSale): void;
  forVendorAndDay(vendorId: string, marketDayId: string): CardSale[];
}
