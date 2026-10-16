import { MonthlyStatement } from '../../domain/entities/statement';
import { BookingRepository, MarketRepository, SaleRepository, SettlementRepository } from '../../domain/repositories';

export class Statements {
  constructor(
    private readonly market: MarketRepository,
    private readonly bookings: BookingRepository,
    private readonly sales: SaleRepository,
    private readonly settlements: SettlementRepository,
  ) {}

  /** month = YYYY-MM */
  monthly(vendorId: string, month: string): MonthlyStatement {
    const days = this.market.days().filter((d) => d.date.startsWith(month));
    const dayIds = new Set(days.map((d) => d.id));
    const salesByProvider: Record<string, number> = {};
    for (const d of days) {
      for (const s of this.sales.forVendorAndDay(vendorId, d.id)) salesByProvider[s.provider] = (salesByProvider[s.provider] ?? 0) + s.amount;
    }
    const lines = this.settlements.all().filter((s) => dayIds.has(s.marketDayId)).flatMap((s) => s.payouts.filter((p) => p.vendorId === vendorId));
    return {
      vendorId, month,
      bookings: this.bookings.forVendor(vendorId).filter((b) => dayIds.has(b.marketDayId)),
      salesByProvider,
      stallFees: lines.reduce((a, l) => a + l.stallFee, 0),
      commission: lines.reduce((a, l) => a + l.commission, 0),
      payouts: lines.reduce((a, l) => a + l.payout, 0),
      carriedBalance: this.settlements.balance(vendorId),
      lines,
    };
  }

  csv(st: MonthlyStatement): string {
    const rows = [['marketDay', 'sales', 'commission', 'stallFee', 'broughtForward', 'payout', 'carriedForward']];
    for (const l of st.lines) rows.push([l.marketDayId, l.sales, l.commission, l.stallFee, l.broughtForward, l.payout, l.carriedForward].map(String));
    rows.push([]);
    for (const [p, v] of Object.entries(st.salesByProvider)) rows.push([`sales ${p}`, String(v)]);
    rows.push(['carried balance', String(st.carriedBalance)]);
    return rows.map((r) => r.join(',')).join('\n');
  }
}
