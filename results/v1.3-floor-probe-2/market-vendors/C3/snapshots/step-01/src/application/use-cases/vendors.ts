import { Booking, DomainError, Vendor } from '../../domain/entities/market';
import { BookingRepository, MarketRepository, VendorRepository } from '../../domain/repositories';
import { assertCanBook } from '../../domain/services/booking-rules';
import { IdGenerator } from '../ports';

export interface RegisterVendorDto { businessName: string; contact: string; products: string[] }

export class VendorUseCases {
  constructor(
    private readonly market: MarketRepository,
    private readonly vendors: VendorRepository,
    private readonly bookings: BookingRepository,
    private readonly ids: IdGenerator,
  ) {}

  register(dto: RegisterVendorDto): Vendor {
    const v = { id: this.ids.next('ven'), ...dto };
    this.vendors.save(v);
    return v;
  }

  list(): Vendor[] { return this.vendors.list(); }

  book(vendorId: string, marketDayId: string, pitchId: string): Booking {
    if (!this.vendors.get(vendorId)) throw new DomainError('unknown vendor');
    if (!this.market.day(marketDayId)) throw new DomainError('unknown market day');
    if (!this.market.pitch(pitchId)) throw new DomainError('unknown pitch');
    assertCanBook(this.bookings.forDay(marketDayId), pitchId, vendorId);
    const b = { id: this.ids.next('bk'), vendorId, marketDayId, pitchId };
    this.bookings.save(b);
    return b;
  }
}
