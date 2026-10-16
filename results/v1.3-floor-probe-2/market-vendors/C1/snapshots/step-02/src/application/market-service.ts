import { assertNotSettled, Booking, cancellationCharged, checkBooking, MarketDay, NotFoundError, Pitch, RuleViolation, Sale, Vendor } from '../domain/model';
import { Bookings, MarketDays, Pitches, ReaderLinks, Sales, Vendors } from '../domain/repositories';

export interface IdSource { next(): string }
export interface Clock { now(): Date }

export interface Repositories {
  days: MarketDays;
  pitches: Pitches;
  vendors: Vendors;
  bookings: Bookings;
  readers: ReaderLinks;
  sales: Sales;
}

export class MarketService {
  constructor(private readonly r: Repositories, private readonly ids: IdSource, private readonly clock: Clock) {}

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

  book(vendorId: string, dayId: string, pitchId: string): Booking {
    this.need(this.r.vendors.byId(vendorId), 'vendor');
    assertNotSettled(this.need(this.r.days.byId(dayId), 'market day'));
    this.need(this.r.pitches.byId(pitchId), 'pitch');
    checkBooking(this.r.bookings.onDay(dayId), pitchId, vendorId);
    const b = { id: this.ids.next(), dayId, pitchId, vendorId };
    this.r.bookings.add(b);
    return b;
  }

  cancelBooking(bookingId: string): Booking {
    const b = this.need(this.r.bookings.byId(bookingId), 'booking');
    if (b.cancelled) throw new RuleViolation('booking already cancelled');
    const day = this.need(this.r.days.byId(b.dayId), 'market day');
    assertNotSettled(day);
    const now = this.clock.now();
    const c: Booking = { ...b, cancelled: { at: now.toISOString(), feeCharged: cancellationCharged(day.date, now) } };
    this.r.bookings.add(c);
    return c;
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

  recordPayLaneSale(readerId: string, amount: number, time: string): Sale {
    const day = this.r.days.byDate(time.slice(0, 10));
    if (!day) throw new RuleViolation('no market day on that date');
    assertNotSettled(day);
    const link = this.r.readers.find(readerId, day.id);
    if (!link) throw new RuleViolation('reader not linked to a vendor that day');
    if (!this.r.bookings.onDay(day.id).some((b) => b.vendorId === link.vendorId && !b.cancelled)) throw new RuleViolation('vendor has no booking that day');
    const s = { id: this.ids.next(), vendorId: link.vendorId, dayId: day.id, readerId, amount, time };
    this.r.sales.add(s);
    return s;
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
