import { Statement } from '../domain/model';
import { Bookings, MarketDays, Sales, Settlements } from '../domain/repositories';
import { SettlementService } from './settlement-service';

export class StatementService {
  constructor(
    private readonly days: MarketDays, private readonly bookings: Bookings, private readonly sales: Sales,
    private readonly settlements: Settlements, private readonly money: SettlementService,
  ) {}

  monthly(vendorId: string, month: string): Statement {
    const dayIds = this.days.list().filter((d) => d.date.startsWith(month)).map((d) => d.id);
    const st: Statement = {
      vendorId, month, bookings: this.bookings.list().filter((b) => b.vendorId === vendorId && dayIds.includes(b.dayId)),
      salesByProvider: {}, fees: 0, commission: 0, payouts: 0, carriedBalance: this.money.balanceOf(vendorId),
    };
    for (const d of dayIds) {
      for (const s of this.sales.of(vendorId, d)) st.salesByProvider[s.provider] = (st.salesByProvider[s.provider] ?? 0) + s.amount;
      const p = this.settlements.ofDay(d)?.payouts.find((x) => x.vendorId === vendorId);
      if (p) { st.fees += p.stallFee; st.commission += p.commission; st.payouts += p.paid; }
    }
    return st;
  }

  toCsv(st: Statement): string {
    const lines = [`vendor,${st.vendorId}`, `month,${st.month}`, `bookings,${st.bookings.length}`];
    for (const [p, v] of Object.entries(st.salesByProvider)) lines.push(`sales ${p},${v}`);
    lines.push(`stall fees,${st.fees}`, `commission,${st.commission}`, `payouts,${st.payouts}`, `carried balance,${st.carriedBalance}`);
    return lines.join('\n');
  }
}
