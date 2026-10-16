export class DomainError extends Error {}

export interface MarketDay { id: string; date: string; status: 'open' | 'closed' | 'settled' }

export type PitchSize = 'small' | 'medium' | 'large';

export interface Pitch { id: string; number: number; size: PitchSize; hasPower: boolean }

export interface Vendor { id: string; businessName: string; contact: string; products: string[] }

export interface Booking {
  id: string;
  marketDayId: string;
  pitchId: string;
  vendorId: string;
  status: 'active' | 'cancelled';
  /** Cancelled less than 48 hours before the day: the stall fee is still due. */
  feeDue: boolean;
}

export type Provider = 'paylane' | 'tillwave';

export interface ReaderLink { readerId: string; marketDayId: string; vendorId: string }

/** TillWave identifies sellers by its own merchant ids. */
export interface MerchantLink { merchantId: string; vendorId: string }

export interface CardSale {
  id: string;
  provider: Provider;
  /** The provider's own id of the sale, used to count a sale reported twice once. */
  externalId: string;
  readerId: string;
  vendorId: string;
  marketDayId: string;
  amount: number;
  at: string;
}
