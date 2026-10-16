export class RuleViolation extends Error {}
export class NotFoundError extends Error {}

export interface MarketDay { id: string; date: string; state: 'open' | 'closed' | 'settled' }
export interface Pitch { id: string; number: number; size: 'small' | 'medium' | 'large'; power: boolean }
export interface Vendor { id: string; name: string; contact: string; products: string[] }
export interface Booking { id: string; dayId: string; pitchId: string; vendorId: string; cancelled?: { at: string; feeCharged: boolean } }
export interface ReaderLink { readerId: string; dayId: string; vendorId: string }
export type Provider = 'paylane' | 'tillwave';
export interface Sale { id: string; provider: Provider; ref: string; vendorId: string; dayId: string; readerId: string; amount: number; time: string }
export interface MerchantLink { merchantId: string; vendorId: string }

export function checkSingleProvider(existing: Sale[], provider: Provider): void {
  const other = existing.find((s) => s.provider !== provider);
  if (other) throw new RuleViolation(`vendor already uses ${other.provider} that day`);
}

export function checkBooking(dayBookings: Booking[], pitchId: string, vendorId: string): void {
  const live = dayBookings.filter((b) => !b.cancelled);
  if (live.some((b) => b.pitchId === pitchId)) throw new RuleViolation('pitch already booked for that day');
  if (live.some((b) => b.vendorId === vendorId)) throw new RuleViolation('vendor already has a pitch that day');
}

export function assertNotSettled(day: MarketDay): void {
  if (day.state === 'settled') throw new RuleViolation('market day is settled');
}

export const FREE_CANCELLATION_HOURS = 48;

export function cancellationCharged(dayDate: string, now: Date): boolean {
  return new Date(`${dayDate}T00:00:00Z`).getTime() - now.getTime() < FREE_CANCELLATION_HOURS * 3_600_000;
}

export interface Fees {
  stall: Record<Pitch['size'], number>;
  powerSurcharge: number;
  commission: number;
  commissionByVendor: Record<string, number>;
}

export interface Payout {
  vendorId: string;
  sales: number;
  commission: number;
  stallFee: number;
  owedBefore: number;
  paid: number;
  owedAfter: number;
}

export interface Settlement { id: string; dayId: string; at: string; payouts: Payout[] }

export function settleVendor(vendorId: string, sales: number, rate: number, stallFee: number, owedBefore: number): Payout {
  const commission = Math.round(sales * rate * 100) / 100;
  const net = Math.round((sales - commission - stallFee - owedBefore) * 100) / 100;
  return { vendorId, sales, commission, stallFee, owedBefore, paid: Math.max(net, 0), owedAfter: Math.max(-net, 0) };
}
