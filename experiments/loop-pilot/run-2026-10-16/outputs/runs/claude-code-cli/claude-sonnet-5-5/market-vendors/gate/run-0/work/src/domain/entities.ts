export type MarketDayStatus = "open" | "closed" | "settled";

export interface MarketDay {
  id: string;
  date: string; // YYYY-MM-DD
  status: MarketDayStatus;
}

export type PitchSize = "small" | "medium" | "large";

export interface Pitch {
  id: string;
  number: number;
  size: PitchSize;
  hasPower: boolean;
}

export interface Vendor {
  id: string;
  businessName: string;
  contact: string;
  products: string[];
  commissionRate: number; // percent of card sales kept by the market
}

export interface Booking {
  id: string;
  marketDayId: string;
  pitchId: string;
  vendorId: string;
  status: "active" | "cancelled";
  stallFee: number; // fixed at booking time
  feeWaived: boolean; // true when cancelled at least 48h before the market day
  cancelledAt?: string;
}

export interface FeeSchedule {
  small: number;
  medium: number;
  large: number;
  powerSurcharge: number;
}

export interface Settlement {
  id: string;
  marketDayId: string;
  vendorId: string;
  sales: number;
  commissionRate: number;
  commission: number;
  stallFee: number;
  carriedIn: number;
  payout: number;
  carriedOut: number;
}

export interface ReaderLink {
  marketDayId: string;
  readerId: string;
  vendorId: string;
}

export type PaymentProvider = "paylane" | "tillwave";

export interface MerchantLink {
  marketDayId: string;
  merchantId: string; // TillWave merchant id
  vendorId: string;
}

export type AuditEntityType = "booking" | "fee-schedule" | "commission-rate" | "card-sale" | "settlement";

export interface AuditEntry {
  id: string;
  time: string; // ISO timestamp
  actor: string; // organiser id, or "system" for provider sales
  entityType: AuditEntityType;
  entityId: string;
  action: "create" | "update";
  marketDayId?: string;
  before: unknown; // null when the entity did not exist
  after: unknown;
}

export interface CardSale {
  id: string;
  marketDayId: string;
  vendorId: string;
  provider: PaymentProvider;
  readerId?: string; // PayLane
  merchantId?: string; // TillWave
  externalId?: string; // provider's own sale id, used to ignore repeats
  amount: number;
  time: string; // ISO timestamp
}
