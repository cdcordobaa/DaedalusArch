import { randomUUID } from "crypto";
import {
  AuditEntityType,
  AuditEntry,
  Booking,
  CardSale,
  FeeSchedule,
  MarketDay,
  MerchantLink,
  Pitch,
  PitchSize,
  ReaderLink,
  Settlement,
  Vendor,
} from "../domain/entities";
import { DomainError } from "../domain/errors";
import {
  AuditLogRepository,
  BookingRepository,
  CardSaleRepository,
  FeeScheduleRepository,
  MarketDayRepository,
  MerchantLinkRepository,
  PitchRepository,
  ReaderLinkRepository,
  SettlementRepository,
  UnitOfWork,
  VendorBalanceRepository,
  VendorRepository,
} from "../domain/repositories";

export interface Repositories {
  days: MarketDayRepository;
  pitches: PitchRepository;
  vendors: VendorRepository;
  bookings: BookingRepository;
  readers: ReaderLinkRepository;
  merchants: MerchantLinkRepository;
  sales: CardSaleRepository;
  fees: FeeScheduleRepository;
  settlements: SettlementRepository;
  balances: VendorBalanceRepository;
  audit: AuditLogRepository;
  uow: UnitOfWork;
}

export const SYSTEM_ACTOR = "system";
export const UNKNOWN_ACTOR = "unknown";

export interface StatementBooking {
  marketDayId: string;
  date: string;
  pitchId: string;
  status: Booking["status"];
  stallFee: number;
  feeWaived: boolean;
}

export interface StatementProviderSales {
  provider: CardSale["provider"];
  count: number;
  total: number;
}

export interface MonthlyStatement {
  vendorId: string;
  businessName: string;
  month: string; // YYYY-MM
  bookings: StatementBooking[];
  cardSales: StatementProviderSales[];
  totalSales: number;
  fees: { stallFees: number; commission: number; total: number };
  settlements: Settlement[];
  payouts: number;
  openingBalance: number; // owed to the market at the start of the month
  carriedBalance: number; // owed to the market at the end of the month
}

const DEFAULT_COMMISSION_RATE = 5;
const FREE_CANCELLATION_MS = 48 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function requireMoney(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new DomainError("validation", `${field} must be a non-negative number`);
  }
  return value;
}

function requireRate(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new DomainError("validation", "commissionRate must be a percentage between 0 and 100");
  }
  return value;
}

/** A sale as reported by TillWave: amount in cents, seller identified by TillWave merchant id. */
export interface TillWaveSale {
  id: string;
  merchantId: string;
  amountCents: number;
  time: string;
}

export interface TillWaveGateway {
  fetchSales(since?: string): Promise<TillWaveSale[]>;
}

export interface TillWavePollResult {
  imported: number;
  duplicates: number;
  rejected: number;
}

const POLL_OVERLAP_MS = 60 * 60 * 1000;

export interface VendorSalesForDay {
  marketDayId: string;
  date: string;
  total: number;
  sales: CardSale[];
}

const SIZES: PitchSize[] = ["small", "medium", "large"];

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DomainError("validation", `${field} must be a non-empty string`);
  }
  return value.trim();
}

export class MarketService {
  constructor(
    private readonly r: Repositories,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Appends an audit record; must be called inside `uow.run` together with the change it describes. */
  private record(
    actor: string,
    entityType: AuditEntityType,
    entityId: string,
    marketDayId: string | undefined,
    before: unknown,
    after: unknown,
  ): void {
    const entry: AuditEntry = {
      id: randomUUID(),
      time: this.now().toISOString(),
      actor,
      entityType,
      entityId,
      action: before === null ? "create" : "update",
      ...(marketDayId === undefined ? {} : { marketDayId }),
      before,
      after,
    };
    this.r.audit.add(entry);
  }

  listAuditLog(marketDayId: string): AuditEntry[] {
    this.getDay(marketDayId);
    return this.r.audit.listByDay(marketDayId);
  }

  createMarketDay(input: { date?: unknown }): MarketDay {
    const date = requireString(input.date, "date");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    ) {
      throw new DomainError("validation", "date must be a valid YYYY-MM-DD date");
    }
    if (this.r.days.getByDate(date)) throw new DomainError("conflict", "market day already exists");
    const day: MarketDay = { id: randomUUID(), date, status: "open" };
    this.r.days.add(day);
    return day;
  }

  listMarketDays(): MarketDay[] {
    return this.r.days.list();
  }

  createPitch(input: { number?: unknown; size?: unknown; hasPower?: unknown }): Pitch {
    const { number, size, hasPower } = input;
    if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) {
      throw new DomainError("validation", "number must be a positive integer");
    }
    if (typeof size !== "string" || !SIZES.includes(size as PitchSize)) {
      throw new DomainError("validation", `size must be one of ${SIZES.join(", ")}`);
    }
    if (typeof hasPower !== "boolean") {
      throw new DomainError("validation", "hasPower must be a boolean");
    }
    if (this.r.pitches.getByNumber(number)) throw new DomainError("conflict", "pitch number already exists");
    const pitch = { id: randomUUID(), number, size: size as PitchSize, hasPower };
    this.r.pitches.add(pitch);
    return pitch;
  }

  listPitches(): Pitch[] {
    return this.r.pitches.list();
  }

  registerVendor(input: {
    businessName?: unknown;
    contact?: unknown;
    products?: unknown;
    commissionRate?: unknown;
  }): Vendor {
    const businessName = requireString(input.businessName, "businessName");
    const contact = requireString(input.contact, "contact");
    if (!Array.isArray(input.products) || !input.products.every((p) => typeof p === "string" && p.trim() !== "")) {
      throw new DomainError("validation", "products must be an array of non-empty strings");
    }
    const commissionRate =
      input.commissionRate === undefined ? DEFAULT_COMMISSION_RATE : requireRate(input.commissionRate);
    const vendor: Vendor = {
      id: randomUUID(),
      businessName,
      contact,
      products: input.products as string[],
      commissionRate,
    };
    this.r.vendors.add(vendor);
    return vendor;
  }

  listVendors(): Vendor[] {
    return this.r.vendors.list();
  }

  getVendor(id: string): Vendor {
    const v = this.r.vendors.get(id);
    if (!v) throw new DomainError("not-found", "vendor not found");
    return v;
  }

  private getDay(id: string): MarketDay {
    const d = this.r.days.get(id);
    if (!d) throw new DomainError("not-found", "market day not found");
    return d;
  }

  bookPitch(marketDayId: string, input: { vendorId?: unknown; pitchId?: unknown }, actor = UNKNOWN_ACTOR): Booking {
    const vendorId = requireString(input.vendorId, "vendorId");
    const pitchId = requireString(input.pitchId, "pitchId");
    this.requireNotSettled(this.getDay(marketDayId));
    this.getVendor(vendorId);
    const pitch = this.r.pitches.get(pitchId);
    if (!pitch) throw new DomainError("not-found", "pitch not found");
    if (this.r.bookings.findByDayAndPitch(marketDayId, pitchId)) {
      throw new DomainError("conflict", "pitch already booked for this market day");
    }
    if (this.r.bookings.findByDayAndVendor(marketDayId, vendorId)) {
      throw new DomainError("conflict", "vendor already holds a pitch for this market day");
    }
    const fees = this.r.fees.get();
    const stallFee = round2(fees[pitch.size] + (pitch.hasPower ? fees.powerSurcharge : 0));
    const booking: Booking = {
      id: randomUUID(),
      marketDayId,
      pitchId,
      vendorId,
      status: "active",
      stallFee,
      feeWaived: false,
    };
    this.r.uow.run(() => {
      this.r.bookings.add(booking);
      this.record(actor, "booking", booking.id, marketDayId, null, booking);
    });
    return booking;
  }

  listBookings(marketDayId: string): Booking[] {
    this.getDay(marketDayId);
    return this.r.bookings.listByDay(marketDayId);
  }

  private requireNotSettled(day: MarketDay): void {
    if (day.status === "settled") throw new DomainError("conflict", "market day is already settled");
  }

  cancelBooking(marketDayId: string, bookingId: string, actor = UNKNOWN_ACTOR): Booking {
    const day = this.getDay(marketDayId);
    const booking = this.r.bookings.get(bookingId);
    if (!booking || booking.marketDayId !== marketDayId) throw new DomainError("not-found", "booking not found");
    this.requireNotSettled(day);
    if (booking.status === "cancelled") throw new DomainError("conflict", "booking already cancelled");
    const now = this.now();
    const cutoff = Date.parse(`${day.date}T00:00:00.000Z`) - FREE_CANCELLATION_MS;
    const cancelled: Booking = {
      ...booking,
      status: "cancelled",
      feeWaived: now.getTime() <= cutoff,
      cancelledAt: now.toISOString(),
    };
    this.r.uow.run(() => {
      this.r.bookings.update(cancelled);
      this.record(actor, "booking", booking.id, marketDayId, booking, cancelled);
    });
    return cancelled;
  }

  closeMarketDay(marketDayId: string): MarketDay {
    const day = this.getDay(marketDayId);
    this.requireNotSettled(day);
    if (day.status === "closed") throw new DomainError("conflict", "market day is already closed");
    const closed: MarketDay = { ...day, status: "closed" };
    this.r.days.update(closed);
    return closed;
  }

  getFees(): FeeSchedule {
    return this.r.fees.get();
  }

  setFees(input: Partial<Record<keyof FeeSchedule, unknown>>, actor = UNKNOWN_ACTOR): FeeSchedule {
    const current = this.r.fees.get();
    const next: FeeSchedule = {
      small: input.small === undefined ? current.small : requireMoney(input.small, "small"),
      medium: input.medium === undefined ? current.medium : requireMoney(input.medium, "medium"),
      large: input.large === undefined ? current.large : requireMoney(input.large, "large"),
      powerSurcharge:
        input.powerSurcharge === undefined
          ? current.powerSurcharge
          : requireMoney(input.powerSurcharge, "powerSurcharge"),
    };
    this.r.uow.run(() => {
      this.r.fees.set(next);
      this.record(actor, "fee-schedule", "fees", undefined, current, next);
    });
    return next;
  }

  setCommissionRate(vendorId: string, input: { commissionRate?: unknown }, actor = UNKNOWN_ACTOR): Vendor {
    const vendor = this.getVendor(vendorId);
    const updated: Vendor = { ...vendor, commissionRate: requireRate(input.commissionRate) };
    this.r.uow.run(() => {
      this.r.vendors.update(updated);
      this.record(
        actor,
        "commission-rate",
        vendorId,
        undefined,
        { vendorId, commissionRate: vendor.commissionRate },
        { vendorId, commissionRate: updated.commissionRate },
      );
    });
    return updated;
  }

  getBalance(vendorId: string): { vendorId: string; owed: number } {
    this.getVendor(vendorId);
    return { vendorId, owed: this.r.balances.get(vendorId) };
  }

  settleMarketDay(marketDayId: string, actor = UNKNOWN_ACTOR): Settlement[] {
    return this.r.uow.run(() => this.doSettle(marketDayId, actor));
  }

  private doSettle(marketDayId: string, actor: string): Settlement[] {
    const day = this.getDay(marketDayId);
    this.requireNotSettled(day);
    if (day.status !== "closed") throw new DomainError("conflict", "market day must be closed before settlement");
    const feeByVendor = new Map<string, number>();
    for (const b of this.r.bookings.listByDay(marketDayId)) {
      if (b.status === "cancelled" && b.feeWaived) continue;
      feeByVendor.set(b.vendorId, round2((feeByVendor.get(b.vendorId) ?? 0) + b.stallFee));
    }
    const salesByVendor = new Map<string, number>();
    for (const v of this.r.vendors.list()) {
      for (const sale of this.r.sales.listByVendor(v.id)) {
        if (sale.marketDayId !== marketDayId) continue;
        salesByVendor.set(v.id, round2((salesByVendor.get(v.id) ?? 0) + sale.amount));
      }
    }
    const results: Settlement[] = [];
    for (const vendor of this.r.vendors.list()) {
      if (!feeByVendor.has(vendor.id) && !salesByVendor.has(vendor.id)) continue;
      const sales = salesByVendor.get(vendor.id) ?? 0;
      const commission = round2((sales * vendor.commissionRate) / 100);
      const stallFee = feeByVendor.get(vendor.id) ?? 0;
      const carriedIn = this.r.balances.get(vendor.id);
      const net = round2(sales - commission - stallFee - carriedIn);
      const settlement: Settlement = {
        id: randomUUID(),
        marketDayId,
        vendorId: vendor.id,
        sales,
        commissionRate: vendor.commissionRate,
        commission,
        stallFee,
        carriedIn,
        payout: Math.max(0, net),
        carriedOut: Math.max(0, round2(-net)),
      };
      this.r.balances.set(vendor.id, settlement.carriedOut);
      this.r.settlements.add(settlement);
      this.record(actor, "settlement", settlement.id, marketDayId, null, settlement);
      results.push(settlement);
    }
    this.r.days.update({ ...day, status: "settled" });
    return results;
  }

  listSettlements(marketDayId: string): Settlement[] {
    this.getDay(marketDayId);
    return this.r.settlements.listByDay(marketDayId);
  }

  linkReader(marketDayId: string, input: { readerId?: unknown; vendorId?: unknown }): ReaderLink {
    const readerId = requireString(input.readerId, "readerId");
    const vendorId = requireString(input.vendorId, "vendorId");
    this.getDay(marketDayId);
    this.getVendor(vendorId);
    if (this.r.merchants.findByVendor(marketDayId, vendorId)) {
      throw new DomainError("conflict", "vendor already uses TillWave on this market day");
    }
    const existing = this.r.readers.find(marketDayId, readerId);
    if (existing && existing.vendorId !== vendorId) {
      throw new DomainError("conflict", "reader already linked to another vendor for this market day");
    }
    const link = { marketDayId, readerId, vendorId };
    this.r.readers.set(link);
    return link;
  }

  recordSale(input: { readerId?: unknown; amount?: unknown; time?: unknown }): CardSale {
    const readerId = requireString(input.readerId, "readerId");
    const { amount } = input;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      throw new DomainError("validation", "amount must be a positive number");
    }
    const t = new Date(requireString(input.time, "time"));
    if (Number.isNaN(t.getTime())) throw new DomainError("validation", "time must be a valid timestamp");
    const day = this.openDayFor(t);
    const link = this.r.readers.find(day.id, readerId);
    if (!link) throw new DomainError("rejected", "reader is not linked to a vendor on this market day");
    return this.storeSale(day, link.vendorId, { provider: "paylane", readerId }, amount, t);
  }

  linkMerchant(marketDayId: string, input: { merchantId?: unknown; vendorId?: unknown }): MerchantLink {
    const merchantId = requireString(input.merchantId, "merchantId");
    const vendorId = requireString(input.vendorId, "vendorId");
    this.getDay(marketDayId);
    this.getVendor(vendorId);
    if (this.r.readers.findByVendor(marketDayId, vendorId)) {
      throw new DomainError("conflict", "vendor already uses PayLane on this market day");
    }
    const existing = this.r.merchants.find(marketDayId, merchantId);
    if (existing && existing.vendorId !== vendorId) {
      throw new DomainError("conflict", "merchant already linked to another vendor for this market day");
    }
    const other = this.r.merchants.findByVendor(marketDayId, vendorId);
    if (other && other.merchantId !== merchantId) {
      throw new DomainError("conflict", "vendor is already linked to another merchant on this market day");
    }
    const link = { marketDayId, merchantId, vendorId };
    this.r.merchants.set(link);
    return link;
  }

  recordTillWaveSale(input: {
    id?: unknown;
    merchantId?: unknown;
    amountCents?: unknown;
    time?: unknown;
  }): CardSale | "duplicate" {
    const externalId = requireString(input.id, "id");
    const merchantId = requireString(input.merchantId, "merchantId");
    const { amountCents } = input;
    if (typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents <= 0) {
      throw new DomainError("validation", "amount must be a positive whole number of cents");
    }
    const t = new Date(requireString(input.time, "time"));
    if (Number.isNaN(t.getTime())) throw new DomainError("validation", "time must be a valid timestamp");
    if (this.r.sales.findByExternalId("tillwave", externalId)) return "duplicate";
    const day = this.openDayFor(t);
    const link = this.r.merchants.find(day.id, merchantId);
    if (!link) throw new DomainError("rejected", "merchant is not linked to a vendor on this market day");
    return this.storeSale(day, link.vendorId, { provider: "tillwave", merchantId, externalId }, amountCents / 100, t);
  }

  private tillWaveCursor?: number;

  async pollTillWave(gateway: TillWaveGateway): Promise<TillWavePollResult> {
    const startedAt = this.now().getTime();
    const since =
      this.tillWaveCursor === undefined ? undefined : new Date(this.tillWaveCursor - POLL_OVERLAP_MS).toISOString();
    const reported = await gateway.fetchSales(since);
    const result: TillWavePollResult = { imported: 0, duplicates: 0, rejected: 0 };
    for (const item of reported) {
      try {
        if (this.recordTillWaveSale(item) === "duplicate") result.duplicates++;
        else result.imported++;
      } catch (e) {
        if (!(e instanceof DomainError)) throw e;
        result.rejected++;
      }
    }
    this.tillWaveCursor = startedAt;
    return result;
  }

  private openDayFor(t: Date): MarketDay {
    const day = this.r.days.getByDate(t.toISOString().slice(0, 10));
    if (!day) throw new DomainError("rejected", "no market day on the date of the sale");
    if (day.status === "settled") throw new DomainError("rejected", "market day is already settled");
    return day;
  }

  private storeSale(
    day: MarketDay,
    vendorId: string,
    source: Pick<CardSale, "provider" | "readerId" | "merchantId" | "externalId">,
    amount: number,
    t: Date,
  ): CardSale {
    if (!this.r.bookings.findByDayAndVendor(day.id, vendorId)) {
      throw new DomainError("rejected", "linked vendor has no booking on this market day");
    }
    const sale: CardSale = {
      id: randomUUID(),
      marketDayId: day.id,
      vendorId,
      ...source,
      amount: round2(amount),
      time: t.toISOString(),
    };
    this.r.uow.run(() => {
      this.r.sales.add(sale);
      this.record(SYSTEM_ACTOR, "card-sale", sale.id, day.id, null, sale);
    });
    return sale;
  }

  getMonthlyStatement(vendorId: string, monthInput: unknown): MonthlyStatement {
    const vendor = this.getVendor(vendorId);
    const month = requireString(monthInput, "month");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new DomainError("validation", "month must be YYYY-MM");
    const dateOf = (marketDayId: string) => this.getDay(marketDayId).date;
    const inMonth = (marketDayId: string) => dateOf(marketDayId).startsWith(`${month}-`);

    const bookings: StatementBooking[] = this.r.bookings
      .listByVendor(vendorId)
      .filter((b) => inMonth(b.marketDayId))
      .map((b) => ({
        marketDayId: b.marketDayId,
        date: dateOf(b.marketDayId),
        pitchId: b.pitchId,
        status: b.status,
        stallFee: b.stallFee,
        feeWaived: b.feeWaived,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const byProvider = new Map<CardSale["provider"], StatementProviderSales>();
    for (const sale of this.r.sales.listByVendor(vendorId)) {
      if (!inMonth(sale.marketDayId)) continue;
      const entry = byProvider.get(sale.provider) ?? { provider: sale.provider, count: 0, total: 0 };
      entry.count++;
      entry.total = round2(entry.total + sale.amount);
      byProvider.set(sale.provider, entry);
    }
    const cardSales = [...byProvider.values()].sort((a, b) => a.provider.localeCompare(b.provider));
    const totalSales = round2(cardSales.reduce((sum, p) => sum + p.total, 0));

    const allSettlements = this.r.settlements
      .listByVendor(vendorId)
      .map((s) => ({ s, date: dateOf(s.marketDayId) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const settlements = allSettlements.filter((x) => x.date.startsWith(`${month}-`)).map((x) => x.s);
    const before = allSettlements.filter((x) => x.date.slice(0, 7) < month);
    const lastBefore = before[before.length - 1];
    const openingBalance = lastBefore ? lastBefore.s.carriedOut : 0;
    const lastInMonth = settlements[settlements.length - 1];
    const carriedBalance = lastInMonth ? lastInMonth.carriedOut : openingBalance;

    const stallFees = round2(settlements.reduce((sum, s) => sum + s.stallFee, 0));
    const commission = round2(settlements.reduce((sum, s) => sum + s.commission, 0));
    return {
      vendorId,
      businessName: vendor.businessName,
      month,
      bookings,
      cardSales,
      totalSales,
      fees: { stallFees, commission, total: round2(stallFees + commission) },
      settlements,
      payouts: round2(settlements.reduce((sum, s) => sum + s.payout, 0)),
      openingBalance,
      carriedBalance,
    };
  }

  listVendorSales(vendorId: string): VendorSalesForDay[] {
    this.getVendor(vendorId);
    const byDay = new Map<string, VendorSalesForDay>();
    for (const sale of this.r.sales.listByVendor(vendorId)) {
      let entry = byDay.get(sale.marketDayId);
      if (!entry) {
        entry = { marketDayId: sale.marketDayId, date: this.getDay(sale.marketDayId).date, total: 0, sales: [] };
        byDay.set(sale.marketDayId, entry);
      }
      entry.sales.push(sale);
      entry.total += sale.amount;
    }
    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
}
