import { Payout } from '../entities/fees';

/** Payout = sales - commission - stall fee - what the vendor still owes; never negative, the rest is carried. */
export function computePayout(vendorId: string, marketDayId: string, sales: number, rate: number, stallFee: number, owed: number): Payout {
  const commission = Math.round(sales * rate * 100) / 100;
  const net = Math.round((sales - commission - stallFee - owed) * 100) / 100;
  return {
    vendorId, marketDayId, sales, commission, stallFee, broughtForward: owed,
    payout: Math.max(0, net), carriedForward: net < 0 ? -net : 0,
  };
}

export const CANCEL_FREE_HOURS = 48;
