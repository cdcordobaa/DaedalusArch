import { MarketDay } from '../../domain/entities/market-day';
import { Pitch, PitchSize } from '../../domain/entities/pitch';
import { BusinessRuleError, NotFound } from '../../domain/errors';
import { Ids, MarketDayRepo, PitchRepo, ReaderRepo, VendorRepo } from '../interfaces/repositories';

export class OrganiserUseCases {
  constructor(private days: MarketDayRepo, private pitches: PitchRepo, private vendors: VendorRepo, private readers: ReaderRepo, private ids: Ids) {}

  createMarketDay(date: string): MarketDay {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BusinessRuleError('date must be YYYY-MM-DD');
    if (this.days.findByDate(date)) throw new BusinessRuleError('market day exists');
    const d = new MarketDay(this.ids.create(), date);
    this.days.save(d);
    return d;
  }

  createPitch(number: number, size: PitchSize, power: boolean): Pitch {
    if (this.pitches.all().some((p) => p.number === number)) throw new BusinessRuleError('pitch number taken');
    const p = new Pitch(this.ids.create(), number, size, power);
    this.pitches.save(p);
    return p;
  }

  closeMarketDay(marketDayId: string): MarketDay {
    const d = this.days.findById(marketDayId);
    if (!d) throw new NotFound('market day');
    d.close();
    this.days.save(d);
    return d;
  }

  assignReader(readerId: string, marketDayId: string, vendorId: string): void {
    if (!this.days.findById(marketDayId)) throw new NotFound('market day');
    if (!this.vendors.findById(vendorId)) throw new NotFound('vendor');
    this.readers.assign({ readerId, marketDayId, vendorId });
  }
}
