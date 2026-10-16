import { Booking, MarketDay, Pitch, ReaderLink, Sale, Vendor } from './model';

export interface Store<T> { add(x: T): void; byId(id: string): T | undefined; list(): T[] }

export interface MarketDays extends Store<MarketDay> { byDate(date: string): MarketDay | undefined }
export type Pitches = Store<Pitch>;
export type Vendors = Store<Vendor>;
export interface Bookings extends Store<Booking> { onDay(dayId: string): Booking[] }
export interface ReaderLinks { link(l: ReaderLink): void; find(readerId: string, dayId: string): ReaderLink | undefined }
export interface Sales extends Store<Sale> { of(vendorId: string, dayId: string): Sale[] }
