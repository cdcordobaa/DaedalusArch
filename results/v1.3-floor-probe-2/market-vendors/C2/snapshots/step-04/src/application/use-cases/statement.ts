import { Booking } from '../../domain/entities/booking';
import { VendorPayout } from '../../domain/entities/fees';
import { NotFound } from '../../domain/errors';
import { BalanceRepo, BookingRepo, MarketDayRepo, SaleRepo, SettlementRepo, VendorRepo } from '../interfaces/repositories';

export interface MonthlyStatementDto {
  vendor: string;
  month: string;
  bookings: Booking[];
  cardSalesByProvider: Record<string, number>;
  fees: number;
  commission: number;
  payouts: number;
  carriedBalance: number;
  days: (VendorPayout & { date: string })[];
}

export class StatementUseCase {
  constructor(
    private vendors: VendorRepo, private days: MarketDayRepo, private bookings: BookingRepo, private sales: SaleRepo,
    private settlements: SettlementRepo, private balances: BalanceRepo,
  ) {}

  monthly(vendorId: string, month: string): MonthlyStatementDto {
    const vendor = this.vendors.findById(vendorId);
    if (!vendor) throw new NotFound('vendor');
    const days = this.days.all().filter((d) => d.date.startsWith(`${month}-`));
    const byProvider: Record<string, number> = {};
    const lines: MonthlyStatementDto['days'] = [];
    for (const d of days) {
      for (const s of this.sales.forVendorOnDay(vendorId, d.id)) byProvider[s.provider] = (byProvider[s.provider] ?? 0) + s.amount;
      const p = this.settlements.findById(d.id)?.payouts.find((x) => x.vendorId === vendorId);
      if (p) lines.push({ ...p, date: d.date });
    }
    const dayIds = new Set(days.map((d) => d.id));
    return {
      vendor: vendor.businessName, month,
      bookings: this.bookings.forVendor(vendorId).filter((b) => dayIds.has(b.marketDayId)),
      cardSalesByProvider: byProvider,
      fees: lines.reduce((s, l) => s + l.stallFee, 0),
      commission: lines.reduce((s, l) => s + l.commission, 0),
      payouts: lines.reduce((s, l) => s + l.payout, 0),
      carriedBalance: this.balances.owed(vendorId),
      days: lines,
    };
  }
}
