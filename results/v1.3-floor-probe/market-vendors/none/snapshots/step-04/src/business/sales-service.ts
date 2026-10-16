import { randomUUID } from 'node:crypto';
import { BusinessError, CardSale, MarketDay, MerchantLink, Provider, ReaderLink, SYSTEM } from './models';
import { auditService } from './audit-service';
import { inTransaction } from '../persistence/transaction';
import {
  bookingRepository,
  cardSaleRepository,
  marketDayRepository,
  merchantLinkRepository,
  pollStateRepository,
  readerLinkRepository,
  vendorRepository,
} from '../persistence/repositories';
import { tillwaveClient } from '../persistence/tillwave-client';

function checkDay(marketDayId: string): MarketDay {
  const day = marketDayRepository.find(marketDayId);
  if (!day) throw new BusinessError('unknown market day', 404);
  if (day.status === 'settled') throw new BusinessError('market day is settled', 409);
  return day;
}

function checkOneProvider(vendorId: string, marketDayId: string, provider: Provider): void {
  const other =
    provider === 'paylane'
      ? merchantLinkRepository.forVendorAndDay(vendorId, marketDayId).length
      : readerLinkRepository.forVendorAndDay(vendorId, marketDayId).length;
  if (other > 0) throw new BusinessError('vendor already uses another card provider on this market day', 409);
}

/** Same checks for every provider: a vendor with a booking on the day of a non-settled market day. */
function acceptSale(provider: Provider, sourceId: string, vendorId: string, day: MarketDay, amount: number, time: string, externalId?: string): CardSale {
  if (!(amount > 0)) throw new BusinessError('amount must be positive');
  if (day.status === 'settled') throw new BusinessError('market day is settled', 409);
  const booked = bookingRepository.activeForDay(day.id).some((b) => b.vendorId === vendorId);
  if (!booked) throw new BusinessError('vendor has no booking on this market day', 422);
  if (externalId) {
    const existing = cardSaleRepository.findByExternalId(provider, externalId);
    if (existing) return existing;
  }
  return inTransaction(() => {
    const sale = cardSaleRepository.save({ id: randomUUID(), readerId: sourceId, externalId, vendorId, marketDayId: day.id, amount, time, provider });
    auditService.record(SYSTEM, 'card-sale', sale.id, { marketDayId: day.id, vendorId }, null, sale);
    return sale;
  });
}

export const salesService = {
  linkReader(readerId: string, marketDayId: string, vendorId: string): ReaderLink {
    checkDay(marketDayId);
    if (!vendorRepository.find(vendorId)) throw new BusinessError('unknown vendor', 404);
    checkOneProvider(vendorId, marketDayId, 'paylane');
    return readerLinkRepository.save({ readerId, marketDayId, vendorId });
  },

  linkMerchant(merchantId: string, marketDayId: string, vendorId: string): MerchantLink {
    checkDay(marketDayId);
    if (!vendorRepository.find(vendorId)) throw new BusinessError('unknown vendor', 404);
    checkOneProvider(vendorId, marketDayId, 'tillwave');
    return merchantLinkRepository.save({ merchantId, marketDayId, vendorId });
  },

  /** A PayLane card sale: accepted only from a reader linked to a vendor with a booking that day. */
  recordPayLaneSale(readerId: string, amount: number, time: string, externalId?: string): CardSale {
    const day = marketDayRepository.findByDate(time.slice(0, 10));
    if (!day) throw new BusinessError('no market day on the sale date', 422);
    const link = readerLinkRepository.find(day.id, readerId);
    if (!link) throw new BusinessError('reader is not linked to a vendor for this market day', 422);
    return acceptSale('paylane', readerId, link.vendorId, day, amount, time, externalId);
  },

  recordTillWaveSale(merchantId: string, amountCents: number, time: string, externalId: string): CardSale {
    const day = marketDayRepository.findByDate(time.slice(0, 10));
    if (!day) throw new BusinessError('no market day on the sale date', 422);
    const link = merchantLinkRepository.find(day.id, merchantId);
    if (!link) throw new BusinessError('merchant is not linked to a vendor for this market day', 422);
    return acceptSale('tillwave', merchantId, link.vendorId, day, amountCents / 100, time, externalId);
  },

  /** Polls TillWave for new sales; rejected sales are logged and skipped. */
  async pollTillWave(): Promise<{ accepted: number; rejected: number }> {
    const { sales, cursor } = await tillwaveClient.salesSince(pollStateRepository.getCursor());
    let accepted = 0;
    let rejected = 0;
    for (const s of sales) {
      try {
        salesService.recordTillWaveSale(s.merchant_id, s.amount_cents, s.created_at, s.id);
        accepted++;
      } catch (e) {
        rejected++;
        console.warn(`TillWave sale ${s.id} rejected: ${(e as Error).message}`);
      }
    }
    if (cursor) pollStateRepository.setCursor(cursor);
    return { accepted, rejected };
  },

  salesForVendor(vendorId: string, marketDayId?: string): CardSale[] {
    return marketDayId ? cardSaleRepository.forVendorAndDay(vendorId, marketDayId) : cardSaleRepository.forVendor(vendorId);
  },
};
