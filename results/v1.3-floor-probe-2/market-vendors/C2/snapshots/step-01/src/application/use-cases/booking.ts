import { Booking } from '../../domain/entities/booking';
import { Vendor } from '../../domain/entities/vendor';
import { NotFound } from '../../domain/errors';
import { BookingRepo, Ids, MarketDayRepo, PitchRepo, VendorRepo } from '../interfaces/repositories';

export class BookingUseCases {
  constructor(private days: MarketDayRepo, private pitches: PitchRepo, private vendors: VendorRepo, private bookings: BookingRepo, private ids: Ids) {}

  registerVendor(businessName: string, contact: string, products: string[]): Vendor {
    const v = new Vendor(this.ids.create(), businessName, contact, products);
    this.vendors.save(v);
    return v;
  }

  bookPitch(vendorId: string, marketDayId: string, pitchId: string): Booking {
    if (!this.vendors.findById(vendorId)) throw new NotFound('vendor');
    if (!this.days.findById(marketDayId)) throw new NotFound('market day');
    if (!this.pitches.findById(pitchId)) throw new NotFound('pitch');
    Booking.ensureFree(this.bookings.forDay(marketDayId), pitchId, vendorId);
    const b = new Booking(this.ids.create(), marketDayId, pitchId, vendorId);
    this.bookings.save(b);
    return b;
  }
}
