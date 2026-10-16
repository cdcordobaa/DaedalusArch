import { BusinessError, MarketDay, Settlement } from './models';
import { auditService } from './audit-service';
import { inTransaction } from '../persistence/transaction';
import {
  balanceRepository,
  bookingRepository,
  cardSaleRepository,
  feeRepository,
  marketDayRepository,
  pitchRepository,
  settlementRepository,
  vendorRepository,
} from '../persistence/repositories';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export const settlementService = {
  closeDay(marketDayId: string): MarketDay {
    const day = marketDayRepository.find(marketDayId);
    if (!day) throw new BusinessError('unknown market day', 404);
    if (day.status !== 'open') throw new BusinessError(`market day is already ${day.status}`, 409);
    return marketDayRepository.save({ ...day, status: 'closed' });
  },

  settle(actor: string, marketDayId: string): Settlement[] {
    return inTransaction(() => this.settleInTx(actor, marketDayId));
  },

  settleInTx(actor: string, marketDayId: string): Settlement[] {
    const day = marketDayRepository.find(marketDayId);
    if (!day) throw new BusinessError('unknown market day', 404);
    if (day.status !== 'closed') throw new BusinessError('only a closed market day can be settled', 409);
    const fees = feeRepository.get();
    const sales = cardSaleRepository.forDay(marketDayId);
    const vendorIds = new Set<string>([
      ...bookingRepository.forDay(marketDayId).filter((b) => b.feeDue).map((b) => b.vendorId),
      ...sales.map((s) => s.vendorId),
    ]);
    const result: Settlement[] = [];
    for (const vendorId of vendorIds) {
      const vendor = vendorRepository.find(vendorId);
      const rate = vendor?.commissionRate ?? fees.defaultCommissionRate;
      const total = round2(sales.filter((s) => s.vendorId === vendorId).reduce((a, s) => a + s.amount, 0));
      let stallFee = 0;
      for (const b of bookingRepository.forDay(marketDayId).filter((x) => x.vendorId === vendorId && x.feeDue)) {
        const pitch = pitchRepository.find(b.pitchNumber);
        if (pitch) stallFee += fees.perSize[pitch.size] + (pitch.hasPower ? fees.powerSurcharge : 0);
      }
      const commission = round2(total * rate);
      const carriedIn = balanceRepository.owed(vendorId);
      const net = round2(total - commission - stallFee - carriedIn);
      const settlement: Settlement = {
        marketDayId,
        vendorId,
        sales: total,
        commission,
        stallFee,
        carriedIn,
        payout: Math.max(0, net),
        carriedOut: net < 0 ? -net : 0,
      };
      balanceRepository.setOwed(vendorId, settlement.carriedOut);
      settlementRepository.save(settlement);
      auditService.record(actor, 'settlement', `${marketDayId}|${vendorId}`, { marketDayId, vendorId }, null, settlement);
      result.push(settlement);
    }
    marketDayRepository.save({ ...day, status: 'settled' });
    return result;
  },

  settlementsForDay(marketDayId: string): Settlement[] {
    return settlementRepository.forDay(marketDayId);
  },
};
