import type { FeeSchedule, Pitch, SettlementLine } from "./entities.js";

export const HOURS_FREE_CANCELLATION = 48;

export const roundMoney = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const stallFeeFor = (schedule: FeeSchedule, pitch: Pitch): number =>
  roundMoney(schedule.stallFees[pitch.size] + (pitch.hasPower ? schedule.powerSurcharge : 0));

/** A market day starts at 00:00 UTC on its date. */
export const isFreeCancellation = (marketDate: string, now: Date): boolean =>
  Date.parse(`${marketDate}T00:00:00.000Z`) - now.getTime() >= HOURS_FREE_CANCELLATION * 3600 * 1000;

export function settleVendor(input: {
  vendorId: string;
  sales: number;
  commissionRate: number;
  stallFee: number;
  carriedIn: number;
}): SettlementLine {
  const sales = roundMoney(input.sales);
  const commission = roundMoney(sales * input.commissionRate);
  const net = roundMoney(sales - commission - input.stallFee - input.carriedIn);
  return {
    vendorId: input.vendorId,
    sales,
    commissionRate: input.commissionRate,
    commission,
    stallFee: input.stallFee,
    carriedIn: input.carriedIn,
    payout: Math.max(0, net),
    carriedOut: Math.max(0, roundMoney(-net)),
  };
}
