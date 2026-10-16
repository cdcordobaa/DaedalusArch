import { randomUUID } from "node:crypto";
import {
  DEFAULT_COMMISSION_RATE,
  PITCH_SIZES,
  type AuditEntityType,
  type AuditEntry,
  type Booking,
  type CardSale,
  type FeeSchedule,
  type MarketDay,
  type MerchantLink,
  type Pitch,
  type PitchSize,
  type ReaderLink,
  type Settlement,
  type TillWaveSale,
  type Vendor,
} from "../domain/entities.js";
import { DomainError, conflict, notFound, validation } from "../domain/errors.js";
import { isFreeCancellation, roundMoney, settleVendor, stallFeeFor } from "../domain/pricing.js";
import type {
  AuditRepository,
  BookingRepository,
  CardSaleRepository,
  FeeScheduleRepository,
  MarketDayRepository,
  MerchantLinkRepository,
  PitchRepository,
  ReaderLinkRepository,
  SettlementRepository,
  VendorRepository,
} from "../domain/repositories.js";

export interface Repositories {
  /** Runs `work` so that all its changes, including audit entries, are saved together or not at all. */
  transaction<T>(work: () => T): T;
  audit: AuditRepository;
  fees: FeeScheduleRepository;
  settlements: SettlementRepository;
  days: MarketDayRepository;
  pitches: PitchRepository;
  vendors: VendorRepository;
  bookings: BookingRepository;
  links: ReaderLinkRepository;
  merchantLinks: MerchantLinkRepository;
  sales: CardSaleRepository;
}

export interface VendorSalesForDay {
  marketDayId: string;
  date: string;
  sales: CardSale[];
  total: number;
}

export const SYSTEM_ACTOR = "system";
export const UNKNOWN_ACTOR = "unknown";

export interface VendorStatement {
  vendorId: string;
  businessName: string;
  month: string;
  bookings: Array<{
    marketDayId: string;
    date: string;
    bookingId: string;
    pitchId: string;
    status: string;
    stallFee: number;
    feeDue: boolean;
  }>;
  cardSales: Array<{ provider: string; count: number; total: number }>;
  fees: { stallFees: number; commission: number; total: number };
  payouts: Array<{ marketDayId: string; date: string; settledAt: string; payout: number }>;
  totalPayouts: number;
  /** Amount the vendor still owed the market at the end of the month. */
  carriedBalance: number;
}

const clone = <T>(v: T): T => structuredClone(v);

const nonEmpty =(v: unknown, field: string): string => {
  if (typeof v !== "string" || v.trim() === "") throw validation(`${field} must be a non-empty string`);
  return v.trim();
};

const money = (v: unknown, field: string): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw validation(`${field} must be a non-negative number`);
  return roundMoney(v);
};

const rate = (v: unknown): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
    throw validation("commission rate must be a number between 0 and 1");
  }
  return v;
};

export class MarketService {
  private readonly r: Repositories;

  private readonly now: () => Date;

  constructor(repositories: Repositories, clock: () => Date = () => new Date()) {
    this.r = repositories;
    this.now = clock;
  }

  getFeeSchedule(): FeeSchedule {
    return this.r.fees.get();
  }

  setFeeSchedule(input: { stallFees: unknown; powerSurcharge: unknown }, actor: string = UNKNOWN_ACTOR): FeeSchedule {
    const fees = input.stallFees;
    if (typeof fees !== "object" || fees === null) throw validation("stallFees must be an object");
    const stallFees = {} as Record<PitchSize, number>;
    for (const size of PITCH_SIZES) {
      stallFees[size] = money((fees as Record<string, unknown>)[size], `stallFees.${size}`);
    }
    const schedule: FeeSchedule = { stallFees, powerSurcharge: money(input.powerSurcharge, "powerSurcharge") };
    return this.r.transaction(() => {
      const before = clone(this.r.fees.get());
      this.r.fees.set(schedule);
      this.record(actor, "fee_schedule.updated", "fee_schedule", "fee-schedule", undefined, before, clone(schedule));
      return schedule;
    });
  }

  setVendorCommission(vendorId: string, input: { rate: unknown }, actor: string = UNKNOWN_ACTOR): Vendor {
    const vendor = this.requireVendor(vendorId);
    const newRate = rate(input.rate);
    return this.r.transaction(() => {
      const before = { commissionRate: vendor.commissionRate };
      vendor.commissionRate = newRate;
      this.r.vendors.save(vendor);
      this.record(actor, "vendor.commission_changed", "vendor_commission", vendor.id, undefined, before, {
        commissionRate: newRate,
      });
      return vendor;
    });
  }

  cancelBooking(dayId: string, bookingId: string, actor: string = UNKNOWN_ACTOR): Booking {
    const day = this.requireDay(dayId);
    this.requireNotSettled(day);
    const booking = this.r.bookings.get(bookingId);
    if (!booking || booking.marketDayId !== day.id) throw notFound(`booking ${bookingId} not found`);
    if (booking.status === "cancelled") throw conflict("booking is already cancelled");
    return this.r.transaction(() => {
      const before = clone(booking);
      booking.status = "cancelled";
      booking.feeDue = !isFreeCancellation(day.date, this.now());
      this.r.bookings.save(booking);
      this.record(actor, "booking.cancelled", "booking", booking.id, day.id, before, clone(booking));
      return booking;
    });
  }

  closeMarketDay(dayId: string): MarketDay {
    const day = this.requireDay(dayId);
    if (day.status !== "open") throw conflict(`market day is already ${day.status}`);
    day.status = "closed";
    this.r.days.save(day);
    return day;
  }

  settleMarketDay(dayId: string, actor: string = UNKNOWN_ACTOR): Settlement {
    return this.r.transaction(() => this.settleInTransaction(dayId, actor));
  }

  private settleInTransaction(dayId: string, actor: string): Settlement {
    const day = this.requireDay(dayId);
    if (day.status === "settled") throw conflict("market day is already settled");
    if (day.status !== "closed") throw conflict("market day must be closed before settlement");
    const lines = [];
    const seen = new Set<string>();
    const balancesBefore: Record<string, number> = {};
    for (const booking of this.r.bookings.listByDay(day.id)) {
      if (!booking.feeDue && booking.status === "cancelled") continue;
      if (seen.has(booking.vendorId)) continue;
      seen.add(booking.vendorId);
      const vendor = this.requireVendor(booking.vendorId);
      balancesBefore[vendor.id] = vendor.balanceOwed;
      const stallFee = roundMoney(
        this.r.bookings
          .listByDay(day.id)
          .filter((b) => b.vendorId === vendor.id && (b.status === "active" || b.feeDue))
          .reduce((t, b) => t + b.stallFee, 0),
      );
      const sales = this.r.sales
        .listByVendor(vendor.id)
        .filter((s) => s.marketDayId === day.id)
        .reduce((t, s) => t + s.amount, 0);
      const line = settleVendor({
        vendorId: vendor.id,
        sales,
        commissionRate: vendor.commissionRate,
        stallFee,
        carriedIn: vendor.balanceOwed,
      });
      vendor.balanceOwed = line.carriedOut;
      this.r.vendors.save(vendor);
      lines.push(line);
    }
    const settlement: Settlement = { marketDayId: day.id, settledAt: this.now().toISOString(), lines };
    this.r.settlements.add(settlement);
    day.status = "settled";
    this.r.days.save(day);
    const balancesAfter: Record<string, number> = {};
    for (const line of lines) balancesAfter[line.vendorId] = line.carriedOut;
    this.record(
      actor,
      "settlement.created",
      "settlement",
      day.id,
      day.id,
      { dayStatus: "closed", balances: balancesBefore },
      clone({ dayStatus: "settled", balances: balancesAfter, settlement }),
    );
    return settlement;
  }

  getSettlement(dayId: string): Settlement {
    const day = this.requireDay(dayId);
    const s = this.r.settlements.findByDay(day.id);
    if (!s) throw notFound("market day has not been settled");
    return s;
  }

  listVendorPayouts(vendorId: string): { balanceOwed: number; payouts: Array<{ marketDayId: string; settledAt: string } & Settlement["lines"][number]> } {
    const vendor = this.requireVendor(vendorId);
    const payouts = [];
    for (const s of this.r.settlements.list()) {
      for (const line of s.lines) {
        if (line.vendorId === vendorId) payouts.push({ marketDayId: s.marketDayId, settledAt: s.settledAt, ...line });
      }
    }
    return { balanceOwed: vendor.balanceOwed, payouts };
  }

  createMarketDay(input: { date: unknown; name?: unknown }): MarketDay {
    const date = nonEmpty(input.date, "date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
      throw validation("date must be a valid YYYY-MM-DD date");
    }
    if (new Date(date).toISOString().slice(0, 10) !== date) throw validation("date must be a valid date");
    const name = input.name === undefined ? "" : nonEmpty(input.name, "name");
    if (this.r.days.findByDate(date)) throw conflict(`market day ${date} already exists`);
    const day: MarketDay = { id: randomUUID(), date, name, status: "open" };
    this.r.days.add(day);
    return day;
  }

  listMarketDays(): MarketDay[] {
    return this.r.days.list();
  }

  createPitch(input: { number: unknown; size: unknown; hasPower: unknown }): Pitch {
    const n = input.number;
    if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) throw validation("number must be a positive integer");
    if (typeof input.size !== "string" || !PITCH_SIZES.includes(input.size as PitchSize)) {
      throw validation(`size must be one of ${PITCH_SIZES.join(", ")}`);
    }
    if (typeof input.hasPower !== "boolean") throw validation("hasPower must be a boolean");
    if (this.r.pitches.findByNumber(n)) throw conflict(`pitch ${n} already exists`);
    const pitch: Pitch = { id: randomUUID(), number: n, size: input.size as PitchSize, hasPower: input.hasPower };
    this.r.pitches.add(pitch);
    return pitch;
  }

  listPitches(): Pitch[] {
    return this.r.pitches.list();
  }

  registerVendor(input: { businessName: unknown; contact: unknown; products: unknown; commissionRate?: unknown }): Vendor {
    const products = input.products;
    if (!Array.isArray(products) || products.length === 0) throw validation("products must be a non-empty array");
    const vendor: Vendor = {
      commissionRate: input.commissionRate === undefined ? DEFAULT_COMMISSION_RATE : rate(input.commissionRate),
      balanceOwed: 0,
      id: randomUUID(),
      businessName: nonEmpty(input.businessName, "businessName"),
      contact: nonEmpty(input.contact, "contact"),
      products: products.map((p: unknown) => nonEmpty(p, "products item")),
    };
    this.r.vendors.add(vendor);
    return vendor;
  }

  listVendors(): Vendor[] {
    return this.r.vendors.list();
  }

  getVendor(id: string): Vendor {
    return this.requireVendor(id);
  }

  bookPitch(dayId: string, input: { vendorId: unknown; pitchId: unknown }, actor: string = UNKNOWN_ACTOR): Booking {
    const day = this.requireDay(dayId);
    this.requireNotSettled(day);
    const vendor = this.requireVendor(nonEmpty(input.vendorId, "vendorId"));
    const pitchId = nonEmpty(input.pitchId, "pitchId");
    const pitch = this.r.pitches.get(pitchId);
    if (!pitch) throw notFound(`pitch ${pitchId} not found`);
    if (this.r.bookings.findByDayAndPitch(day.id, pitchId)) throw conflict("pitch already booked for this market day");
    if (this.r.bookings.findByDayAndVendor(day.id, vendor.id)) {
      throw conflict("vendor already holds a pitch for this market day");
    }
    const booking: Booking = {
      id: randomUUID(),
      marketDayId: day.id,
      pitchId,
      vendorId: vendor.id,
      status: "active",
      stallFee: stallFeeFor(this.r.fees.get(), pitch),
      feeDue: true,
    };
    return this.r.transaction(() => {
      this.r.bookings.add(booking);
      this.record(actor, "booking.created", "booking", booking.id, day.id, null, clone(booking));
      return booking;
    });
  }

  listBookings(dayId: string): Booking[] {
    return this.r.bookings.listByDay(this.requireDay(dayId).id).filter((b) => b.status === "active");
  }

  linkReader(dayId: string, input: { readerId: unknown; vendorId: unknown }): ReaderLink {
    const day = this.requireDay(dayId);
    this.requireNotSettled(day);
    const readerId = nonEmpty(input.readerId, "readerId");
    const vendor = this.requireVendor(nonEmpty(input.vendorId, "vendorId"));
    if (!this.r.bookings.findByDayAndVendor(day.id, vendor.id)) {
      throw conflict("vendor has no booking on this market day");
    }
    if (this.r.links.find(day.id, readerId)) throw conflict("reader already linked for this market day");
    if (this.r.merchantLinks.findByVendor(day.id, vendor.id)) {
      throw conflict("vendor already uses TillWave on this market day");
    }
    const link: ReaderLink = { marketDayId: day.id, readerId, vendorId: vendor.id };
    this.r.links.add(link);
    return link;
  }

  linkMerchant(dayId: string, input: { merchantId: unknown; vendorId: unknown }): MerchantLink {
    const day = this.requireDay(dayId);
    this.requireNotSettled(day);
    const merchantId = nonEmpty(input.merchantId, "merchantId");
    const vendor = this.requireVendor(nonEmpty(input.vendorId, "vendorId"));
    if (!this.r.bookings.findByDayAndVendor(day.id, vendor.id)) {
      throw conflict("vendor has no booking on this market day");
    }
    if (this.r.merchantLinks.find(day.id, merchantId)) throw conflict("merchant already linked for this market day");
    if (this.r.links.findByVendor(day.id, vendor.id)) throw conflict("vendor already uses PayLane on this market day");
    if (this.r.merchantLinks.findByVendor(day.id, vendor.id)) {
      throw conflict("vendor already has a TillWave merchant on this market day");
    }
    const link: MerchantLink = { marketDayId: day.id, merchantId, vendorId: vendor.id };
    this.r.merchantLinks.add(link);
    return link;
  }

  /**
   * Records sales polled from TillWave. Sales already recorded are ignored; sales that fail
   * the usual checks are returned as rejected so the caller can retry them later.
   */
  recordTillWaveSales(input: TillWaveSale[]): { recorded: CardSale[]; duplicates: number; rejected: TillWaveSale[] } {
    const recorded: CardSale[] = [];
    const rejected: TillWaveSale[] = [];
    let duplicates = 0;
    for (const raw of input) {
      if (this.r.sales.findByExternal("tillwave", String(raw.id))) {
        duplicates++;
        continue;
      }
      try {
        const cents = raw.amountCents;
        if (typeof cents !== "number" || !Number.isInteger(cents) || cents <= 0) {
          throw validation("amountCents must be a positive integer");
        }
        const ms = Date.parse(nonEmpty(raw.time, "time"));
        if (Number.isNaN(ms)) throw validation("time must be an ISO 8601 timestamp");
        const time = new Date(ms).toISOString();
        const day = this.r.days.findByDate(time.slice(0, 10));
        if (!day) throw validation("no market day for the sale time");
        this.requireNotSettled(day);
        const link = this.r.merchantLinks.find(day.id, nonEmpty(raw.merchantId, "merchantId"));
        if (!link || !this.r.bookings.findByDayAndVendor(day.id, link.vendorId)) {
          throw validation("merchant is not linked to a vendor with a booking on that market day");
        }
        const sale: CardSale = {
          id: randomUUID(),
          marketDayId: day.id,
          vendorId: link.vendorId,
          readerId: link.merchantId,
          amount: roundMoney(cents / 100),
          time,
          provider: "tillwave",
          externalId: nonEmpty(raw.id, "id"),
        };
        this.r.transaction(() => {
          this.r.sales.add(sale);
          this.record(SYSTEM_ACTOR, "card_sale.recorded", "card_sale", sale.id, day.id, null, clone(sale));
        });
        recorded.push(sale);
      } catch (e) {
        if (!(e instanceof DomainError)) throw e;
        rejected.push(raw);
      }
    }
    return { recorded, duplicates, rejected };
  }

  /** Records a PayLane card sale; the market day is the UTC date of the sale time. */
  recordSale(input: { readerId: unknown; amount: unknown; time: unknown }): CardSale {
    const readerId = nonEmpty(input.readerId, "readerId");
    const amount = input.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      throw validation("amount must be a positive number");
    }
    const ms = Date.parse(nonEmpty(input.time, "time"));
    if (Number.isNaN(ms)) throw validation("time must be an ISO 8601 timestamp");
    const time = new Date(ms).toISOString();
    const day = this.r.days.findByDate(time.slice(0, 10));
    if (!day) throw validation("no market day for the sale time");
    this.requireNotSettled(day);
    const link = this.r.links.find(day.id, readerId);
    if (!link || !this.r.bookings.findByDayAndVendor(day.id, link.vendorId)) {
      throw validation("reader is not linked to a vendor with a booking on that market day");
    }
    const sale: CardSale = { id: randomUUID(), marketDayId: day.id, vendorId: link.vendorId, readerId, amount, time, provider: "paylane" };
    return this.r.transaction(() => {
      this.r.sales.add(sale);
      this.record(SYSTEM_ACTOR, "card_sale.recorded", "card_sale", sale.id, day.id, null, clone(sale));
      return sale;
    });
  }

  listVendorSales(vendorId: string, dayId?: string): VendorSalesForDay[] {
    this.requireVendor(vendorId);
    const days = dayId === undefined ? this.r.days.list() : [this.requireDay(dayId)];
    const all = this.r.sales.listByVendor(vendorId);
    const result: VendorSalesForDay[] = [];
    for (const d of days) {
      const sales = all.filter((s) => s.marketDayId === d.id);
      if (sales.length === 0 && dayId === undefined) continue;
      result.push({ marketDayId: d.id, date: d.date, sales, total: sales.reduce((t, s) => t + s.amount, 0) });
    }
    return result;
  }

  listAuditLog(dayId: string): AuditEntry[] {
    return this.r.audit.listByDay(this.requireDay(dayId).id);
  }

  listAllAuditLog(): AuditEntry[] {
    return this.r.audit.list();
  }

  getVendorStatement(vendorId: string, monthInput: unknown): VendorStatement {
    const vendor = this.requireVendor(vendorId);
    if (typeof monthInput !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthInput)) {
      throw validation("month must be in YYYY-MM format");
    }
    const month = monthInput;
    const allDays = this.r.days.list();
    const dayById = new Map(allDays.map((d) => [d.id, d]));
    const bookings: VendorStatement["bookings"] = [];
    for (const d of allDays) {
      if (!d.date.startsWith(month)) continue;
      for (const b of this.r.bookings.listByDay(d.id)) {
        if (b.vendorId !== vendor.id) continue;
        bookings.push({
          marketDayId: d.id,
          date: d.date,
          bookingId: b.id,
          pitchId: b.pitchId,
          status: b.status,
          stallFee: b.stallFee,
          feeDue: b.feeDue,
        });
      }
    }
    const byProvider = new Map<string, { provider: string; count: number; total: number }>();
    for (const s of this.r.sales.listByVendor(vendor.id)) {
      if (!s.time.startsWith(month)) continue;
      const e = byProvider.get(s.provider) ?? { provider: s.provider, count: 0, total: 0 };
      e.count++;
      e.total = roundMoney(e.total + s.amount);
      byProvider.set(s.provider, e);
    }
    const lines: Array<{ date: string; settledAt: string; marketDayId: string; line: Settlement["lines"][number] }> = [];
    for (const st of this.r.settlements.list()) {
      const day = dayById.get(st.marketDayId);
      const line = st.lines.find((l) => l.vendorId === vendor.id);
      if (day && line) lines.push({ date: day.date, settledAt: st.settledAt, marketDayId: day.id, line });
    }
    lines.sort((a, b) => a.date.localeCompare(b.date) || a.settledAt.localeCompare(b.settledAt));
    const inMonth = lines.filter((l) => l.date.startsWith(month));
    const upTo = lines.filter((l) => l.date.slice(0, 7) <= month);
    const stallFees = roundMoney(inMonth.reduce((t, l) => t + l.line.stallFee, 0));
    const commission = roundMoney(inMonth.reduce((t, l) => t + l.line.commission, 0));
    const payouts = inMonth.map((l) => ({
      marketDayId: l.marketDayId,
      date: l.date,
      settledAt: l.settledAt,
      payout: l.line.payout,
    }));
    const last = upTo[upTo.length - 1];
    return {
      vendorId: vendor.id,
      businessName: vendor.businessName,
      month,
      bookings,
      cardSales: [...byProvider.values()],
      fees: { stallFees, commission, total: roundMoney(stallFees + commission) },
      payouts,
      totalPayouts: roundMoney(payouts.reduce((t, p) => t + p.payout, 0)),
      carriedBalance: last ? last.line.carriedOut : 0,
    };
  }

  private record(
    actor: string,
    action: string,
    entityType: AuditEntityType,
    entityId: string,
    marketDayId: string | undefined,
    before: unknown,
    after: unknown,
  ): void {
    const entry: AuditEntry = {
      id: randomUUID(),
      seq: this.r.audit.list().length + 1,
      actor,
      at: this.now().toISOString(),
      action,
      entityType,
      entityId,
      before,
      after,
    };
    if (marketDayId !== undefined) entry.marketDayId = marketDayId;
    this.r.audit.add(entry);
  }

  private requireDay(id: string): MarketDay {
    const d = this.r.days.get(id);
    if (!d) throw notFound(`market day ${id} not found`);
    return d;
  }

  private requireNotSettled(day: MarketDay): void {
    if (day.status === "settled") throw conflict("market day is settled");
  }

  private requireVendor(id: string): Vendor {
    const v = this.r.vendors.get(id);
    if (!v) throw notFound(`vendor ${id} not found`);
    return v;
  }
}
