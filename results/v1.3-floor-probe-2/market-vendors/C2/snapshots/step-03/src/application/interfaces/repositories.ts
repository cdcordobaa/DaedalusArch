import { MarketDay } from '../../domain/entities/market-day';
import { Pitch } from '../../domain/entities/pitch';
import { Vendor } from '../../domain/entities/vendor';
import { Booking } from '../../domain/entities/booking';
import { CardSale, MerchantAssignment, ReaderAssignment } from '../../domain/entities/card-sale';
import { FeeTable } from '../../domain/entities/fees';
import { Settlement } from '../../domain/entities/settlement';

export interface Repo<T> { save(x: T): void; findById(id: string): T | undefined; all(): T[] }

export interface MarketDayRepo extends Repo<MarketDay> { findByDate(date: string): MarketDay | undefined }
export type PitchRepo = Repo<Pitch>;
export type VendorRepo = Repo<Vendor>;
export interface BookingRepo extends Repo<Booking> { forDay(marketDayId: string): Booking[] }
export interface SaleRepo extends Repo<CardSale> { forVendorOnDay(vendorId: string, marketDayId: string): CardSale[]; forDay(marketDayId: string): CardSale[]; findByProviderId(provider: string, providerSaleId: string): CardSale | undefined }
export interface ReaderRepo { assign(a: ReaderAssignment): void; find(readerId: string, marketDayId: string): ReaderAssignment | undefined }
export interface MerchantRepo { assign(a: MerchantAssignment): void; find(merchantId: string): MerchantAssignment | undefined }
export interface Ids { create(): string }
export interface FeeRepo { get(): FeeTable; save(t: FeeTable): void }
export type SettlementRepo = Repo<Settlement>;
export interface BalanceRepo { owed(vendorId: string): number; set(vendorId: string, owed: number): void }
export interface Clock { now(): Date }
