import { payoutFor } from '../../domain/entities/fees';
import { Settlement } from '../../domain/entities/settlement';
import { NotFound } from '../../domain/errors';
import { BalanceRepo, BookingRepo, Clock, FeeRepo, MarketDayRepo, PitchRepo, SaleRepo, SettlementRepo, UnitOfWork } from '../interfaces/repositories';
import { AuditTrail } from './audit';

export class SettlementUseCase {
  constructor(
    private days: MarketDayRepo,
    private pitches: PitchRepo,
    private bookings: BookingRepo,
    private sales: SaleRepo,
    private fees: FeeRepo,
    private balances: BalanceRepo,
    private settlements: SettlementRepo,
    private clock: Clock,
    private audit: AuditTrail,
    private uow: UnitOfWork,
  ) {}

  settle(marketDayId: string, by: string): Settlement {
    return this.uow.atomically(() => this.run(marketDayId, by));
  }

  private run(marketDayId: string, by: string): Settlement {
    const day = this.days.findById(marketDayId);
    if (!day) throw new NotFound('market day');
    day.markSettled();
    const table = this.fees.get();
    const sales = this.sales.forDay(marketDayId);
    const charged = this.bookings.forDay(marketDayId).filter((b) => !(b.cancelled && b.feeWaived));
    const vendorIds = new Set([...charged.map((b) => b.vendorId), ...sales.map((s) => s.vendorId)]);
    const payouts = [...vendorIds].map((vendorId) => {
      const total = sales.filter((s) => s.vendorId === vendorId).reduce((sum, s) => sum + s.amount, 0);
      const stall = charged.filter((b) => b.vendorId === vendorId).reduce((sum, b) => {
        const p = this.pitches.findById(b.pitchId);
        return p ? sum + table.stallFee(p.size, p.power) : sum;
      }, 0);
      const p = payoutFor(vendorId, total, table.commissionFor(vendorId), stall, this.balances.owed(vendorId));
      this.balances.set(vendorId, p.stillOwed);
      return p;
    });
    const s = new Settlement(marketDayId, this.clock.now().toISOString(), payouts);
    this.settlements.save(s);
    this.days.save(day);
    this.audit.log(by, 'settlement', s.id, marketDayId, null, s);
    return s;
  }

  find(marketDayId: string): Settlement | undefined { return this.settlements.findById(marketDayId); }
}
