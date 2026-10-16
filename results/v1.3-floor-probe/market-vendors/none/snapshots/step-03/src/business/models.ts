export type MarketDayStatus = 'open' | 'closed' | 'settled';

export interface MarketDay {
  id: string;
  date: string; // YYYY-MM-DD
  status: MarketDayStatus;
}

export type PitchSize = 'small' | 'medium' | 'large';

export interface Pitch {
  number: number;
  size: PitchSize;
  hasPower: boolean;
}

export interface Vendor {
  id: string;
  businessName: string;
  contact: string;
  products: string[];
  commissionRate?: number; // overrides the default
}

export interface Booking {
  id: string;
  marketDayId: string;
  pitchNumber: number;
  vendorId: string;
  cancelledAt?: string;
  /** false when cancelled 48 hours or more before the market day */
  feeDue: boolean;
}

export interface ReaderLink {
  readerId: string;
  marketDayId: string;
  vendorId: string;
}

export type Provider = 'paylane' | 'tillwave';

export interface MerchantLink {
  merchantId: string;
  marketDayId: string;
  vendorId: string;
}

export interface CardSale {
  id: string;
  /** PayLane reader id or TillWave merchant id */
  readerId: string;
  externalId?: string;
  vendorId: string;
  marketDayId: string;
  amount: number;
  time: string;
  provider: Provider;
}

export interface FeeSchedule {
  perSize: Record<PitchSize, number>;
  powerSurcharge: number;
  defaultCommissionRate: number;
}

export interface Settlement {
  marketDayId: string;
  vendorId: string;
  sales: number;
  commission: number;
  stallFee: number;
  carriedIn: number;
  payout: number;
  carriedOut: number;
}

export class BusinessError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}
