import { BusinessError, Provider } from './models';
import {
  bookingRepository,
  cardSaleRepository,
  marketDayRepository,
  pitchRepository,
  settlementRepository,
  vendorRepository,
} from '../persistence/repositories';

export interface MonthlyStatement {
  vendor: string;
  month: string;
  bookings: { date: string; pitch: number; cancelled: boolean; feeDue: boolean }[];
  salesByProvider: Record<Provider, number>;
  stallFees: number;
  commission: number;
  payouts: number;
  carriedBalance: number;
}

export const statementService = {
  monthly(vendorId: string, month: string): MonthlyStatement {
    const vendor = vendorRepository.find(vendorId);
    if (!vendor) throw new BusinessError('unknown vendor', 404);
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BusinessError('month must be YYYY-MM');
    const days = new Map(marketDayRepository.all().filter((d) => d.date.startsWith(month)).map((d) => [d.id, d]));
    const bookings = bookingRepository
      .forVendor(vendorId)
      .filter((b) => days.has(b.marketDayId))
      .map((b) => ({ date: days.get(b.marketDayId)?.date ?? '', pitch: pitchRepository.find(b.pitchNumber)?.number ?? b.pitchNumber, cancelled: !!b.cancelledAt, feeDue: b.feeDue }));
    const salesByProvider: Record<Provider, number> = { paylane: 0, tillwave: 0 };
    for (const s of cardSaleRepository.forVendor(vendorId)) if (days.has(s.marketDayId)) salesByProvider[s.provider] += s.amount;
    const settlements = settlementRepository.forVendor(vendorId).filter((s) => days.has(s.marketDayId));
    const sorted = settlements.sort((a, b) => (days.get(a.marketDayId)?.date ?? '').localeCompare(days.get(b.marketDayId)?.date ?? ''));
    return {
      vendor: vendor.businessName,
      month,
      bookings,
      salesByProvider,
      stallFees: settlements.reduce((a, s) => a + s.stallFee, 0),
      commission: settlements.reduce((a, s) => a + s.commission, 0),
      payouts: settlements.reduce((a, s) => a + s.payout, 0),
      carriedBalance: sorted.length ? sorted[sorted.length - 1].carriedOut : 0,
    };
  },
};
