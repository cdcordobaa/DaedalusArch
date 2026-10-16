import { BusinessRuleError } from '../errors';

export class Booking {
  public cancelled = false;
  public feeWaived = false;

  constructor(public readonly id: string, public readonly marketDayId: string, public readonly pitchId: string, public readonly vendorId: string) {}

  /** Free cancellation up to 48 hours before the market day (taken as starting at 00:00 UTC). */
  cancel(marketDate: string, now: Date): void {
    if (this.cancelled) throw new BusinessRuleError('booking already cancelled');
    this.cancelled = true;
    this.feeWaived = new Date(`${marketDate}T00:00:00Z`).getTime() - now.getTime() >= 48 * 3600 * 1000;
  }

  static ensureFree(dayBookings: Booking[], pitchId: string, vendorId: string): void {
    const active = dayBookings.filter((b) => !b.cancelled);
    if (active.some((b) => b.pitchId === pitchId)) throw new BusinessRuleError('pitch is already booked that day');
    if (active.some((b) => b.vendorId === vendorId)) throw new BusinessRuleError('vendor already has a pitch that day');
  }
}
