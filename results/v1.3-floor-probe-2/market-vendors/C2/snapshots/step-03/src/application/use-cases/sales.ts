import { CardSale, PaymentProvider } from '../../domain/entities/card-sale';
import { BusinessRuleError } from '../../domain/errors';
import { BookingRepo, Ids, MarketDayRepo, MerchantRepo, ReaderRepo, SaleRepo } from '../interfaces/repositories';

export class SalesUseCases {
  constructor(private days: MarketDayRepo, private readers: ReaderRepo, private bookings: BookingRepo, private sales: SaleRepo, private ids: Ids, private merchants: MerchantRepo) {}

  acceptPayLaneSale(readerId: string, amount: number, time: string, saleId?: string): CardSale {
    const day = this.days.findByDate(time.slice(0, 10));
    const a = day && this.readers.find(readerId, day.id);
    if (!day || !a) throw new BusinessRuleError('reader not linked to a vendor for that market day');
    return this.accept('PayLane', saleId ?? `${readerId}:${time}`, a.vendorId, readerId, amount, time);
  }

  assignMerchant(merchantId: string, vendorId: string): void { this.merchants.assign({ merchantId, vendorId }); }

  /** TillWave reports cents and its own merchant ids. */
  acceptTillWaveSale(saleId: string, merchantId: string, amountCents: number, time: string): CardSale {
    const m = this.merchants.find(merchantId);
    if (!m) throw new BusinessRuleError(`TillWave merchant ${merchantId} is not linked to a vendor`);
    return this.accept('TillWave', saleId, m.vendorId, merchantId, amountCents / 100, time);
  }

  private accept(provider: PaymentProvider, providerSaleId: string, vendorId: string, readerId: string, amount: number, time: string): CardSale {
    const existing = this.sales.findByProviderId(provider, providerSaleId);
    if (existing) return existing;
    const day = this.days.findByDate(time.slice(0, 10));
    if (!day) throw new BusinessRuleError('no market day on that date');
    day.ensureChangeable();
    if (!this.bookings.forDay(day.id).some((b) => b.vendorId === vendorId && !b.cancelled)) throw new BusinessRuleError('vendor has no booking that day');
    if (this.sales.forVendorOnDay(vendorId, day.id).some((s) => s.provider !== provider)) {
      throw new BusinessRuleError('vendor already takes card payments with another provider that day');
    }
    const s = new CardSale(this.ids.create(), provider, providerSaleId, vendorId, day.id, readerId, amount, time);
    this.sales.save(s);
    return s;
  }

  listSales(vendorId: string, marketDayId: string): CardSale[] { return this.sales.forVendorOnDay(vendorId, marketDayId); }
}
