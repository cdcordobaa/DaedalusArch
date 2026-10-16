import { randomUUID } from 'node:crypto';
import { BusinessError, CardSale, ReaderLink } from './models';
import {
  bookingRepository,
  cardSaleRepository,
  marketDayRepository,
  readerLinkRepository,
  vendorRepository,
} from '../persistence/repositories';

export const salesService = {
  linkReader(readerId: string, marketDayId: string, vendorId: string): ReaderLink {
    if (!marketDayRepository.find(marketDayId)) throw new BusinessError('unknown market day', 404);
    if (!vendorRepository.find(vendorId)) throw new BusinessError('unknown vendor', 404);
    return readerLinkRepository.save({ readerId, marketDayId, vendorId });
  },

  /** A PayLane card sale: accepted only from a reader linked to a vendor with a booking that day. */
  recordPayLaneSale(readerId: string, amount: number, time: string): CardSale {
    if (!(amount > 0)) throw new BusinessError('amount must be positive');
    const day = marketDayRepository.findByDate(time.slice(0, 10));
    if (!day) throw new BusinessError('no market day on the sale date', 422);
    if (day.status === 'settled') throw new BusinessError('market day is settled', 409);
    const link = readerLinkRepository.find(day.id, readerId);
    if (!link) throw new BusinessError('reader is not linked to a vendor for this market day', 422);
    const booked = bookingRepository.activeForDay(day.id).some((b) => b.vendorId === link.vendorId);
    if (!booked) throw new BusinessError('vendor has no booking on this market day', 422);
    return cardSaleRepository.save({
      id: randomUUID(),
      readerId,
      vendorId: link.vendorId,
      marketDayId: day.id,
      amount,
      time,
      provider: 'paylane',
    });
  },

  salesForVendor(vendorId: string, marketDayId?: string): CardSale[] {
    return marketDayId ? cardSaleRepository.forVendorAndDay(vendorId, marketDayId) : cardSaleRepository.forVendor(vendorId);
  },
};
