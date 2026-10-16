import { CardSale } from '../../domain/entities/card-sale';
import { BusinessRuleError } from '../../domain/errors';
import { BookingRepo, Ids, MarketDayRepo, ReaderRepo, SaleRepo } from '../interfaces/repositories';

export class SalesUseCases {
  constructor(private days: MarketDayRepo, private readers: ReaderRepo, private bookings: BookingRepo, private sales: SaleRepo, private ids: Ids) {}

  acceptPayLaneSale(readerId: string, amount: number, time: string): CardSale {
    const day = this.days.findByDate(time.slice(0, 10));
    const a = day && this.readers.find(readerId, day.id);
    if (!day || !a) throw new BusinessRuleError('reader not linked to a vendor for that market day');
    if (!this.bookings.forDay(day.id).some((b) => b.vendorId === a.vendorId)) throw new BusinessRuleError('vendor has no booking that day');
    const s = new CardSale(this.ids.create(), a.vendorId, day.id, readerId, amount, time);
    this.sales.save(s);
    return s;
  }

  listSales(vendorId: string, marketDayId: string): CardSale[] { return this.sales.forVendorOnDay(vendorId, marketDayId); }
}
