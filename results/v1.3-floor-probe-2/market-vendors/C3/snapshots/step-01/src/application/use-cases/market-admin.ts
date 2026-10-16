import { DomainError, MarketDay, Pitch, PitchSize, ReaderLink } from '../../domain/entities/market';
import { BookingRepository, MarketRepository, ReaderLinkRepository, VendorRepository } from '../../domain/repositories';
import { IdGenerator } from '../ports';

export class MarketAdmin {
  constructor(
    private readonly market: MarketRepository,
    private readonly vendors: VendorRepository,
    private readonly bookings: BookingRepository,
    private readonly links: ReaderLinkRepository,
    private readonly ids: IdGenerator,
  ) {}

  defineDay(date: string): MarketDay {
    if (this.market.dayByDate(date)) throw new DomainError(`market day ${date} already exists`);
    const d = { id: this.ids.next('day'), date };
    this.market.saveDay(d);
    return d;
  }

  definePitch(number: number, size: PitchSize, hasPower: boolean): Pitch {
    if (this.market.pitches().some((p) => p.number === number)) throw new DomainError(`pitch ${number} exists`);
    const p = { id: this.ids.next('pitch'), number, size, hasPower };
    this.market.savePitch(p);
    return p;
  }

  linkReader(readerId: string, marketDayId: string, vendorId: string): ReaderLink {
    if (!this.market.day(marketDayId)) throw new DomainError('unknown market day');
    if (!this.vendors.get(vendorId)) throw new DomainError('unknown vendor');
    const l = { readerId, marketDayId, vendorId };
    this.links.save(l);
    return l;
  }

  listDays(): MarketDay[] { return this.market.days(); }
  listPitches(): Pitch[] { return this.market.pitches(); }
  bookingsFor(marketDayId: string) { return this.bookings.forDay(marketDayId); }
}
