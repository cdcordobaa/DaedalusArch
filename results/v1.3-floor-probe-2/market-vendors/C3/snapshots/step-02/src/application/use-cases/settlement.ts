import { DomainError, PitchSize } from '../../domain/entities/market';
import { FeeSchedule, Settlement } from '../../domain/entities/fees';
import {
  BookingRepository, FeeRepository, MarketRepository, SaleRepository, SettlementRepository,
} from '../../domain/repositories';
import { computePayout } from '../../domain/services/settlement';
import { Clock } from '../ports';

export class Fees {
  constructor(private readonly fees: FeeRepository) {}

  setStallFee(size: PitchSize, fee: number): FeeSchedule {
    const s = this.fees.schedule();
    const next = { ...s, stallFee: { ...s.stallFee, [size]: fee } };
    this.fees.saveSchedule(next);
    return next;
  }

  setPowerSurcharge(amount: number): FeeSchedule {
    const next = { ...this.fees.schedule(), powerSurcharge: amount };
    this.fees.saveSchedule(next);
    return next;
  }

  setCommission(vendorId: string, rate: number): void {
    if (rate < 0 || rate > 1) throw new DomainError('rate must be between 0 and 1');
    this.fees.setVendorRate(vendorId, rate);
  }

  schedule(): FeeSchedule { return this.fees.schedule(); }
}

export class RunSettlement {
  constructor(
    private readonly market: MarketRepository,
    private readonly bookings: BookingRepository,
    private readonly sales: SaleRepository,
    private readonly fees: FeeRepository,
    private readonly settlements: SettlementRepository,
    private readonly clock: Clock,
  ) {}

  run(marketDayId: string): Settlement {
    const day = this.market.day(marketDayId);
    if (!day) throw new DomainError('unknown market day');
    if (day.status !== 'closed') throw new DomainError('close the market day before settling it');
    const schedule = this.fees.schedule();
    const daySales = this.sales.forDay(marketDayId);
    const vendorIds = new Set<string>([
      ...this.bookings.forDay(marketDayId).filter((b) => b.feeDue).map((b) => b.vendorId),
      ...daySales.map((s) => s.vendorId),
    ]);
    const payouts = [...vendorIds].map((vendorId) => {
      const total = daySales.filter((s) => s.vendorId === vendorId).reduce((a, s) => a + s.amount, 0);
      const stallFee = this.bookings.forDay(marketDayId)
        .filter((b) => b.vendorId === vendorId && b.feeDue)
        .reduce((a, b) => {
          const pitch = this.market.pitch(b.pitchId);
          return pitch ? a + schedule.stallFee[pitch.size] + (pitch.hasPower ? schedule.powerSurcharge : 0) : a;
        }, 0);
      const rate = this.fees.vendorRate(vendorId) ?? schedule.defaultCommissionRate;
      const p = computePayout(vendorId, marketDayId, total, rate, stallFee, this.settlements.balance(vendorId));
      this.settlements.setBalance(vendorId, p.carriedForward);
      return p;
    });
    const s: Settlement = { marketDayId, settledAt: this.clock.now().toISOString(), payouts };
    this.settlements.save(s);
    this.market.saveDay({ ...day, status: 'settled' });
    return s;
  }

  get(marketDayId: string): Settlement | undefined { return this.settlements.get(marketDayId); }
}
