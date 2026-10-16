import { PitchSize } from './market';

export interface FeeSchedule {
  stallFee: Record<PitchSize, number>;
  powerSurcharge: number;
  defaultCommissionRate: number;
}

export interface Payout {
  vendorId: string;
  marketDayId: string;
  sales: number;
  commission: number;
  stallFee: number;
  broughtForward: number;
  payout: number;
  carriedForward: number;
}

export interface Settlement { marketDayId: string; settledAt: string; payouts: Payout[] }
