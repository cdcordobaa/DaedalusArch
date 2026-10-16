export class DomainError extends Error {}

export interface MarketDay { id: string; date: string }

export type PitchSize = 'small' | 'medium' | 'large';

export interface Pitch { id: string; number: number; size: PitchSize; hasPower: boolean }

export interface Vendor { id: string; businessName: string; contact: string; products: string[] }

export interface Booking { id: string; marketDayId: string; pitchId: string; vendorId: string }

export interface ReaderLink { readerId: string; marketDayId: string; vendorId: string }

export interface CardSale {
  id: string;
  readerId: string;
  vendorId: string;
  marketDayId: string;
  amount: number;
  at: string;
}
