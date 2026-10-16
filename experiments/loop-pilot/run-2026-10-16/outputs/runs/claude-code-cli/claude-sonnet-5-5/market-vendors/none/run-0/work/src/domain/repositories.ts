import type {
  AuditEntry,
  Booking,
  CardSale,
  FeeSchedule,
  MarketDay,
  Pitch,
  MerchantLink,
  ReaderLink,
  Settlement,
  Vendor,
} from "./entities.js";

export interface MarketDayRepository {
  add(day: MarketDay): void;
  save(day: MarketDay): void;
  get(id: string): MarketDay | undefined;
  findByDate(date: string): MarketDay | undefined;
  list(): MarketDay[];
}

export interface PitchRepository {
  add(pitch: Pitch): void;
  get(id: string): Pitch | undefined;
  findByNumber(n: number): Pitch | undefined;
  list(): Pitch[];
}

export interface VendorRepository {
  add(vendor: Vendor): void;
  save(vendor: Vendor): void;
  get(id: string): Vendor | undefined;
  list(): Vendor[];
}

export interface BookingRepository {
  add(booking: Booking): void;
  save(booking: Booking): void;
  get(id: string): Booking | undefined;
  /** Only active bookings are considered. */
  findByDayAndPitch(dayId: string, pitchId: string): Booking | undefined;
  findByDayAndVendor(dayId: string, vendorId: string): Booking | undefined;
  /** All bookings for the day, including cancelled ones. */
  listByDay(dayId: string): Booking[];
}

export interface ReaderLinkRepository {
  add(link: ReaderLink): void;
  find(dayId: string, readerId: string): ReaderLink | undefined;
  findByVendor(dayId: string, vendorId: string): ReaderLink | undefined;
}

export interface MerchantLinkRepository {
  add(link: MerchantLink): void;
  find(dayId: string, merchantId: string): MerchantLink | undefined;
  findByVendor(dayId: string, vendorId: string): MerchantLink | undefined;
}

export interface CardSaleRepository {
  add(sale: CardSale): void;
  findByExternal(provider: string, externalId: string): CardSale | undefined;
  listByVendor(vendorId: string): CardSale[];
}

export interface FeeScheduleRepository {
  get(): FeeSchedule;
  set(schedule: FeeSchedule): void;
}

export interface AuditRepository {
  add(entry: AuditEntry): void;
  /** Entries in the order they were recorded. */
  list(): AuditEntry[];
  listByDay(dayId: string): AuditEntry[];
}

export interface SettlementRepository {
  add(settlement: Settlement): void;
  findByDay(dayId: string): Settlement | undefined;
  list(): Settlement[];
}
