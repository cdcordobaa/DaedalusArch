import { Booking } from './market';
import { Payout } from './fees';

export interface MonthlyStatement {
  vendorId: string;
  month: string;
  bookings: Booking[];
  salesByProvider: Record<string, number>;
  stallFees: number;
  commission: number;
  payouts: number;
  carriedBalance: number;
  lines: Payout[];
}
