import { CardSale, DomainError } from '../../domain/entities/market';
import { BookingRepository, MarketRepository, ReaderLinkRepository, SaleRepository } from '../../domain/repositories';
import { IdGenerator } from '../ports';

export interface PayLaneSaleDto { readerId: string; amount: number; time: string }

export class CardSales {
  constructor(
    private readonly market: MarketRepository,
    private readonly links: ReaderLinkRepository,
    private readonly bookings: BookingRepository,
    private readonly sales: SaleRepository,
    private readonly ids: IdGenerator,
  ) {}

  recordPayLaneSale(dto: PayLaneSaleDto): CardSale {
    const day = this.market.dayByDate(dto.time.slice(0, 10));
    if (!day) throw new DomainError('no market day on the sale date');
    const link = this.links.find(dto.readerId, day.id);
    if (!link) throw new DomainError('reader is not linked to a vendor for this market day');
    if (!this.bookings.forDay(day.id).some((b) => b.vendorId === link.vendorId)) {
      throw new DomainError('linked vendor has no booking on this market day');
    }
    if (!(dto.amount > 0)) throw new DomainError('amount must be positive');
    const s: CardSale = { id: this.ids.next('sale'), readerId: dto.readerId, vendorId: link.vendorId, marketDayId: day.id, amount: dto.amount, at: dto.time };
    this.sales.save(s);
    return s;
  }

  salesOf(vendorId: string, marketDayId: string): CardSale[] { return this.sales.forVendorAndDay(vendorId, marketDayId); }
}
