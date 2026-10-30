import type { SeatPayment } from '../../../domain/model/SeatPayment';

/** Spending a voucher, in the application's own terms; amounts in euros. */
export interface Redemptions {
  take(code: string, amount: number, flightId: string): Promise<SeatPayment>;
}
