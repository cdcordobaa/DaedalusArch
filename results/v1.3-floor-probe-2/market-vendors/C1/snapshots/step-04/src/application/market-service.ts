import {
  assertNotSettled, Booking, cancellationCharged, checkBooking, checkSingleProvider, MarketDay, NotFoundError, Pitch, Provider, RuleViolation,
  Sale, Vendor,
} from '../domain/model';
import { Auditing, SYSTEM } from './audit';
import { Bookings, MarketDays, MerchantLinks, Pitches, ReaderLinks, Sales, Vendors } from '../domain/repositories';

export interface IdSource { next(): string }
export interface Clock { now(): Date }

export interface Repositories {
  days: MarketDays;
  pitches: Pitches;
  vendors: Vendors;
  bookings: Bookings;
  readers: ReaderLinks;
  merchants: MerchantLinks;
  sales: Sales;
}

/** A sale as TillWave reports it (amount in cents, seller as TillWave merchant id). */
export interface TillWaveSale { id: string; merchantId: string; cents: number; time: string }

/** Port to TillWave's HTTP API. */
export interface TillWaveFeed { fetchSince(cursor?: string): Promise<{ sales: TillWaveSale[]; cursor?: string }> }

export class MarketService {
  private audit?: Auditing;

  constructor(private readonly r: Repositories, private readonly ids: IdSource, private readonly clock: Clock) {}

  useAuditing(a: Auditing): void { this.audit = a; }

  private changed<T>(actor: string, type: 'booking' | 'sale', ref: string, dayId: string, before: unknown, work: () => T): T {
    return this.audit ? this.audit.change(actor, type, ref, dayId, before, work) : work();
  }

  addMarketDay(date: string): MarketDay {
    if (this.r.days.byDate(date)) throw new RuleViolation('market day already defined');
    const d: MarketDay = { id: this.ids.next(), date, state: 'open' };
    this.r.days.add(d);
    return d;
  }

  addPitch(number: number, size: Pitch['size'], power: boolean): Pitch {
    const p = { id: this.ids.next(), number, size, power };
    this.r.pitches.add(p);
    return p;
  }

  registerVendor(name: string, contact: string, products: string[]): Vendor {
    const v = { id: this.ids.next(), name, contact, products };
    this.r.vendors.add(v);
    return v;
  }

  book(vendorId: string, dayId: string, pitchId: string, actor: string): Booking {
    this.need(this.r.vendors.byId(vendorId), 'vendor');
    assertNotSettled(this.need(this.r.days.byId(dayId), 'market day'));
    this.need(this.r.pitches.byId(pitchId), 'pitch');
    checkBooking(this.r.bookings.onDay(dayId), pitchId, vendorId);
    const b = { id: this.ids.next(), dayId, pitchId, vendorId };
    return this.changed(actor, 'booking', b.id, dayId, null, () => { this.r.bookings.add(b); return b; });
  }

  cancelBooking(bookingId: string, actor: string): Booking {
    const b = this.need(this.r.bookings.byId(bookingId), 'booking');
    if (b.cancelled) throw new RuleViolation('booking already cancelled');
    const day = this.need(this.r.days.byId(b.dayId), 'market day');
    assertNotSettled(day);
    const now = this.clock.now();
    const c: Booking = { ...b, cancelled: { at: now.toISOString(), feeCharged: cancellationCharged(day.date, now) } };
    return this.changed(actor, 'booking', b.id, b.dayId, b, () => { this.r.bookings.add(c); return c; });
  }

  closeDay(dayId: string): MarketDay {
    const d = this.need(this.r.days.byId(dayId), 'market day');
    if (d.state !== 'open') throw new RuleViolation(`market day is ${d.state}`);
    const c = { ...d, state: 'closed' as const };
    this.r.days.add(c);
    return c;
  }

  linkReader(readerId: string, dayId: string, vendorId: string): void {
    this.need(this.r.days.byId(dayId), 'market day');
    this.need(this.r.vendors.byId(vendorId), 'vendor');
    this.r.readers.link({ readerId, dayId, vendorId });
  }

  recordPayLaneSale(readerId: string, amount: number, time: string, ref?: string): Sale {
    const day = this.r.days.byDate(time.slice(0, 10));
    if (!day) throw new RuleViolation('no market day on that date');
    const link = this.r.readers.find(readerId, day.id);
    if (!link) throw new RuleViolation('reader not linked to a vendor that day');
    return this.recordSale('paylane', ref ?? `${readerId}/${time}`, link.vendorId, readerId, amount, time);
  }

  linkMerchant(merchantId: string, vendorId: string): void {
    this.need(this.r.vendors.byId(vendorId), 'vendor');
    this.r.merchants.link({ merchantId, vendorId });
  }

  /** One TillWave poll: every new sale goes through the same checks; returns the next cursor. */
  async pullTillWave(feed: TillWaveFeed, cursor?: string): Promise<{ cursor?: string; accepted: number; errors: string[] }> {
    const page = await feed.fetchSince(cursor);
    const errors: string[] = [];
    let accepted = 0;
    for (const t of page.sales) {
      try {
        const m = this.r.merchants.find(t.merchantId);
        if (!m) throw new RuleViolation(`unknown TillWave merchant ${t.merchantId}`);
        this.recordSale('tillwave', t.id, m.vendorId, t.merchantId, t.cents / 100, t.time);
        accepted++;
      } catch (e) {
        errors.push(`${t.id}: ${(e as Error).message}`);
      }
    }
    return { cursor: page.cursor ?? cursor, accepted, errors };
  }

  private recordSale(provider: Provider, ref: string, vendorId: string, readerId: string, amount: number, time: string): Sale {
    const seen = this.r.sales.byRef(provider, ref);
    if (seen) return seen;
    const day = this.r.days.byDate(time.slice(0, 10));
    if (!day) throw new RuleViolation('no market day on that date');
    assertNotSettled(day);
    if (!this.r.bookings.onDay(day.id).some((b) => b.vendorId === vendorId && !b.cancelled)) throw new RuleViolation('vendor has no booking that day');
    checkSingleProvider(this.r.sales.of(vendorId, day.id), provider);
    const s: Sale = { id: this.ids.next(), provider, ref, vendorId, dayId: day.id, readerId, amount, time };
    return this.changed(SYSTEM, 'sale', s.id, day.id, null, () => { this.r.sales.add(s); return s; });
  }

  salesOf(vendorId: string, dayId: string): Sale[] { return this.r.sales.of(vendorId, dayId); }
  days(): MarketDay[] { return this.r.days.list(); }
  pitches(): Pitch[] { return this.r.pitches.list(); }
  vendors(): Vendor[] { return this.r.vendors.list(); }

  private need<T>(x: T | undefined, what: string): T {
    if (x === undefined) throw new NotFoundError(`${what} not found`);
    return x;
  }
}
