export type PitchSize = "small" | "medium" | "large";
export const PITCH_SIZES: readonly PitchSize[] = ["small", "medium", "large"];

export type MarketDayStatus = "open" | "closed" | "settled";

export interface MarketDay {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  status: MarketDayStatus;
}

export interface Pitch {
  id: string;
  number: number;
  size: PitchSize;
  hasPower: boolean;
}

export const DEFAULT_COMMISSION_RATE = 0.05;

export interface Vendor {
  id: string;
  businessName: string;
  contact: string;
  products: string[];
  /** Fraction of each card sale kept by the market, 0..1. */
  commissionRate: number;
  /** Amount the vendor still owes the market from earlier settlements. */
  balanceOwed: number;
}

export interface Booking {
  id: string;
  marketDayId: string;
  pitchId: string;
  vendorId: string;
  status: "active" | "cancelled";
  /** Stall fee fixed when the booking was made. */
  stallFee: number;
  /** Whether the stall fee is still payable (false when cancelled in time). */
  feeDue: boolean;
}

export interface ReaderLink {
  marketDayId: string;
  readerId: string;
  vendorId: string;
}

export type PaymentProvider = "paylane" | "tillwave";

export interface MerchantLink {
  marketDayId: string;
  merchantId: string;
  vendorId: string;
}

/** A sale as reported by TillWave: amount in cents, seller identified by TillWave merchant id. */
export interface TillWaveSale {
  id: string;
  merchantId: string;
  amountCents: number;
  time: string;
}

export interface CardSale {
  id: string;
  marketDayId: string;
  vendorId: string;
  /** PayLane reader id, or TillWave merchant id. */
  readerId: string;
  amount: number;
  time: string; // ISO timestamp
  provider: PaymentProvider;
  /** Provider's own sale id, used to ignore repeated reports. */
  externalId?: string;
}

export interface FeeSchedule {
  stallFees: Record<PitchSize, number>;
  powerSurcharge: number;
}

export interface SettlementLine {
  vendorId: string;
  sales: number;
  commissionRate: number;
  commission: number;
  stallFee: number;
  carriedIn: number;
  payout: number;
  carriedOut: number;
}

export type AuditEntityType = "booking" | "fee_schedule" | "vendor_commission" | "card_sale" | "settlement";

export interface AuditEntry {
  id: string;
  seq: number;
  /** Organiser id from the request, or 'system' for provider sales. */
  actor: string;
  at: string;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  /** Set for changes that belong to one market day. */
  marketDayId?: string;
  before: unknown;
  after: unknown;
}

export interface Settlement {
  marketDayId: string;
  settledAt: string;
  lines: SettlementLine[];
}
