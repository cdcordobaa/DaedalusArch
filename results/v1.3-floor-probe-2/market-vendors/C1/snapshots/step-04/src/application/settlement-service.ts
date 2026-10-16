import { Fees, NotFoundError, Pitch, RuleViolation, Settlement, settleVendor } from '../domain/model';
import { Balances, Bookings, FeeSettings, MarketDays, Pitches, Sales, Settlements } from '../domain/repositories';
import { Clock, IdSource } from './market-service';
import { Auditing } from './audit';

export class SettlementService {
  constructor(
    private readonly days: MarketDays,
    private readonly pitches: Pitches,
    private readonly bookings: Bookings,
    private readonly sales: Sales,
    private readonly fees: FeeSettings,
    private readonly settlements: Settlements,
    private readonly balances: Balances,
    private readonly ids: IdSource,
    private readonly clock: Clock,
    private readonly audit: Auditing,
  ) {}

  getFees(): Fees { return this.fees.get(); }

  setStallFee(size: Pitch['size'], amount: number, actor: string): Fees { return this.update(actor, (f) => ({ ...f, stall: { ...f.stall, [size]: amount } })); }
  setPowerSurcharge(amount: number, actor: string): Fees { return this.update(actor, (f) => ({ ...f, powerSurcharge: amount })); }
  setVendorCommission(vendorId: string, rate: number, actor: string): Fees {
    if (!(rate >= 0 && rate < 1)) throw new RuleViolation('rate must be between 0 and 1');
    return this.update(actor, (f) => ({ ...f, commissionByVendor: { ...f.commissionByVendor, [vendorId]: rate } }));
  }

  settle(dayId: string, actor: string): Settlement {
    return this.audit.change(actor, 'settlement', dayId, dayId, null, () => this.doSettle(dayId));
  }

  private doSettle(dayId: string): Settlement {
    const day = this.days.byId(dayId);
    if (!day) throw new NotFoundError('market day not found');
    if (day.state !== 'closed') throw new RuleViolation('market day must be closed and not yet settled');
    const fees = this.fees.get();
    const daySales = this.sales.onDay(dayId);
    const charged = this.bookings.onDay(dayId).filter((b) => !b.cancelled || b.cancelled.feeCharged);
    const vendorIds = [...new Set([...charged.map((b) => b.vendorId), ...daySales.map((s) => s.vendorId)])];
    const payouts = vendorIds.map((v) => {
      const total = daySales.filter((s) => s.vendorId === v).reduce((a, s) => a + s.amount, 0);
      const stallFee = charged.filter((b) => b.vendorId === v).reduce((a, b) => {
        const p = this.pitches.byId(b.pitchId);
        return a + (p ? fees.stall[p.size] + (p.power ? fees.powerSurcharge : 0) : 0);
      }, 0);
      const p = settleVendor(v, total, fees.commissionByVendor[v] ?? fees.commission, stallFee, this.balances.owed(v));
      this.balances.setOwed(v, p.owedAfter);
      return p;
    });
    const s: Settlement = { id: this.ids.next(), dayId, at: this.clock.now().toISOString(), payouts };
    this.settlements.add(s);
    this.days.add({ ...day, state: 'settled' });
    return s;
  }

  settlementOf(dayId: string): Settlement | undefined { return this.settlements.ofDay(dayId); }

  private update(actor: string, f: (x: Fees) => Fees): Fees {
    const before = this.fees.get();
    return this.audit.change(actor, 'fees', 'fees', undefined, before, () => {
      const next = f(before);
      this.fees.put(next);
      return next;
    });
  }

  balanceOf(vendorId: string): number { return this.balances.owed(vendorId); }
}
