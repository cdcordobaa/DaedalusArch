import { CardSale, DomainError, Provider } from '../../domain/entities/market';
import { BookingRepository, MarketRepository, ReaderLinkRepository, SaleRepository } from '../../domain/repositories';
import { IdGenerator, TillWaveApi, Transaction } from '../ports';
import { AuditLog } from './audit';
import { SYSTEM } from '../../domain/entities/audit';

export interface PayLaneSaleDto { readerId: string; amount: number; time: string; saleId?: string }

export class CardSales {
  constructor(
    private readonly market: MarketRepository,
    private readonly links: ReaderLinkRepository,
    private readonly bookings: BookingRepository,
    private readonly sales: SaleRepository,
    private readonly ids: IdGenerator,
    private readonly audit: AuditLog,
    private readonly tx: Transaction,
  ) {}

  recordPayLaneSale(dto: PayLaneSaleDto): CardSale {
    const dayId = this.market.dayByDate(dto.time.slice(0, 10))?.id;
    const link = dayId ? this.links.find(dto.readerId, dayId) : undefined;
    if (dayId && !link) throw new DomainError('reader is not linked to a vendor for this market day');
    return this.record('paylane', dto.saleId ?? `${dto.readerId}@${dto.time}`, dto.readerId, link?.vendorId ?? '', dto.amount, dto.time);
  }

  linkMerchant(merchantId: string, vendorId: string): void { this.links.saveMerchant({ merchantId, vendorId }); }

  /** One poll of TillWave; returns the new cursor. Rejected sales are skipped and reported. */
  async pollTillWave(api: TillWaveApi, cursor: string | undefined): Promise<{ cursor: string; recorded: number; rejected: string[] }> {
    const page = await api.salesSince(cursor);
    let recorded = 0;
    const rejected: string[] = [];
    for (const t of page.sales) {
      try {
        const link = this.links.merchant(t.merchantId);
        if (!link) throw new DomainError(`merchant ${t.merchantId} is not linked to a vendor`);
        const before = this.sales.byExternalId('tillwave', t.saleId);
        this.record('tillwave', t.saleId, t.merchantId, link.vendorId, t.amountCents / 100, t.time);
        if (!before) recorded++;
      } catch (e) {
        rejected.push(`${t.saleId}: ${(e as Error).message}`);
      }
    }
    return { cursor: page.cursor, recorded, rejected };
  }

  private record(provider: Provider, externalId: string, readerId: string, vendorId: string, amount: number, time: string): CardSale {
    const dup = this.sales.byExternalId(provider, externalId);
    if (dup) return dup;
    const day = this.market.dayByDate(time.slice(0, 10));
    if (!day) throw new DomainError('no market day on the sale date');
    if (day.status === 'settled') throw new DomainError('market day is settled');
    if (!this.bookings.forDay(day.id).some((b) => b.vendorId === vendorId && b.status === 'active')) {
      throw new DomainError('vendor has no booking on this market day');
    }
    const other = this.sales.forVendorAndDay(vendorId, day.id).find((s) => s.provider !== provider);
    if (other) throw new DomainError(`vendor already uses ${other.provider} on this market day`);
    if (!(amount > 0)) throw new DomainError('amount must be positive');
    const s: CardSale = { id: this.ids.next('sale'), provider, externalId, readerId, vendorId, marketDayId: day.id, amount, at: time };
    this.tx.run(() => {
      this.sales.save(s);
      this.audit.record(SYSTEM, 'sale', s.id, null, s, s.marketDayId);
    });
    return s;
  }

  salesOf(vendorId: string, marketDayId: string): CardSale[] { return this.sales.forVendorAndDay(vendorId, marketDayId); }
}
