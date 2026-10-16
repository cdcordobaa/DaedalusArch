import { MarketDay } from '../../domain/entities/market-day';
import { Pitch } from '../../domain/entities/pitch';
import { Vendor } from '../../domain/entities/vendor';
import { Booking } from '../../domain/entities/booking';
import { CardSale, ReaderAssignment } from '../../domain/entities/card-sale';

export interface Repo<T> { save(x: T): void; findById(id: string): T | undefined; all(): T[] }

export interface MarketDayRepo extends Repo<MarketDay> { findByDate(date: string): MarketDay | undefined }
export type PitchRepo = Repo<Pitch>;
export type VendorRepo = Repo<Vendor>;
export interface BookingRepo extends Repo<Booking> { forDay(marketDayId: string): Booking[] }
export interface SaleRepo extends Repo<CardSale> { forVendorOnDay(vendorId: string, marketDayId: string): CardSale[] }
export interface ReaderRepo { assign(a: ReaderAssignment): void; find(readerId: string, marketDayId: string): ReaderAssignment | undefined }
export interface Ids { create(): string }
