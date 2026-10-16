import { AuditEntry, Booking, CardSale, FeeSchedule, MarketDay, MerchantLink, Pitch, ReaderLink, Settlement, Vendor } from "./entities";

export interface MarketDayRepository {
  add(day: MarketDay): void;
  get(id: string): MarketDay | undefined;
  getByDate(date: string): MarketDay | undefined;
  update(day: MarketDay): void;
  list(): MarketDay[];
}

export interface PitchRepository {
  add(pitch: Pitch): void;
  get(id: string): Pitch | undefined;
  getByNumber(number: number): Pitch | undefined;
  list(): Pitch[];
}

export interface VendorRepository {
  add(vendor: Vendor): void;
  get(id: string): Vendor | undefined;
  update(vendor: Vendor): void;
  list(): Vendor[];
}

export interface BookingRepository {
  add(booking: Booking): void;
  get(id: string): Booking | undefined;
  update(booking: Booking): void;
  findByDayAndPitch(marketDayId: string, pitchId: string): Booking | undefined;
  findByDayAndVendor(marketDayId: string, vendorId: string): Booking | undefined;
  listByDay(marketDayId: string): Booking[];
  listByVendor(vendorId: string): Booking[];
}

export interface ReaderLinkRepository {
  set(link: ReaderLink): void;
  find(marketDayId: string, readerId: string): ReaderLink | undefined;
  findByVendor(marketDayId: string, vendorId: string): ReaderLink | undefined;
}

export interface MerchantLinkRepository {
  set(link: MerchantLink): void;
  find(marketDayId: string, merchantId: string): MerchantLink | undefined;
  findByVendor(marketDayId: string, vendorId: string): MerchantLink | undefined;
}

export interface CardSaleRepository {
  add(sale: CardSale): void;
  findByExternalId(provider: string, externalId: string): CardSale | undefined;
  listByVendor(vendorId: string): CardSale[];
}

export interface FeeScheduleRepository {
  get(): FeeSchedule;
  set(schedule: FeeSchedule): void;
}

export interface SettlementRepository {
  add(settlement: Settlement): void;
  listByDay(marketDayId: string): Settlement[];
  listByVendor(vendorId: string): Settlement[];
}

export interface AuditLogRepository {
  add(entry: AuditEntry): void;
  listByDay(marketDayId: string): AuditEntry[];
}

/** Runs a unit of work atomically: if it throws, every change made inside it is undone. */
export interface UnitOfWork {
  run<T>(work: () => T): T;
}

export interface VendorBalanceRepository {
  get(vendorId: string): number; // amount the vendor still owes the market
  set(vendorId: string, owed: number): void;
}
