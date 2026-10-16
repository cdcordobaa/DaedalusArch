import { Booking, CardSale, MarketDay, Pitch, ReaderLink, Vendor } from '../entities/market';
import { FeeSchedule, Settlement } from '../entities/fees';

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
  get(id: string): Booking | undefined;
  forDay(marketDayId: string): Booking[];
}

export interface ReaderLinkRepository {
  save(l: ReaderLink): void;
  find(readerId: string, marketDayId: string): ReaderLink | undefined;
}

export interface SaleRepository {
  save(s: CardSale): void;
  forVendorAndDay(vendorId: string, marketDayId: string): CardSale[];
  forDay(marketDayId: string): CardSale[];
}

export interface FeeRepository {
  schedule(): FeeSchedule;
  saveSchedule(s: FeeSchedule): void;
  vendorRate(vendorId: string): number | undefined;
  setVendorRate(vendorId: string, rate: number): void;
}

export interface SettlementRepository {
  save(s: Settlement): void;
  get(marketDayId: string): Settlement | undefined;
  /** What the vendor still owes from their latest settlement. */
  balance(vendorId: string): number;
  setBalance(vendorId: string, owed: number): void;
}
