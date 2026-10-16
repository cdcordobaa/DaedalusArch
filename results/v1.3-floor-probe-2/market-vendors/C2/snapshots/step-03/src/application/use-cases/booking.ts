import { Booking } from '../../domain/entities/booking';
import { Vendor } from '../../domain/entities/vendor';
import { NotFound } from '../../domain/errors';
import { BookingRepo, Clock, Ids, MarketDayRepo, PitchRepo, VendorRepo } from '../interfaces/repositories';

export class BookingUseCases {
  constructor(private days: MarketDayRepo, private pitches: PitchRepo, private vendors: VendorRepo, private bookings: BookingRepo, private ids: Ids, private clock: Clock) {}

  registerVendor(businessName: string, contact: string, products: string[]): Vendor {
    const v = new Vendor(this.ids.create(), businessName, contact, products);
    this.vendors.save(v);
    return v;
  }

  bookPitch(vendorId: string, marketDayId: string, pitchId: string): Booking {
    if (!this.vendors.findById(vendorId)) throw new NotFound('vendor');
    const day = this.days.findById(marketDayId);
    if (!day) throw new NotFound('market day');
    day.ensureChangeable();
    if (!this.pitches.findById(pitchId)) throw new NotFound('pitch');
    Booking.ensureFree(this.bookings.forDay(marketDayId), pitchId, vendorId);
    const b = new Booking(this.ids.create(), marketDayId, pitchId, vendorId);
    this.bookings.save(b);
    return b;
  }

  cancelBooking(bookingId: string): Booking {
    const b = this.bookings.findById(bookingId);
    if (!b) throw new NotFound('booking');
    const day = this.days.findById(b.marketDayId);
    if (!day) throw new NotFound('market day');
    day.ensureChangeable();
    b.cancel(day.date, this.clock.now());
    this.bookings.save(b);
    return b;
  }
}
