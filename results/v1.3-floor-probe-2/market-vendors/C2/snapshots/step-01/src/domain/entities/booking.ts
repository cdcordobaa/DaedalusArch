import { BusinessRuleError } from '../errors';

export class Booking {
  constructor(public readonly id: string, public readonly marketDayId: string, public readonly pitchId: string, public readonly vendorId: string) {}

  static ensureFree(dayBookings: Booking[], pitchId: string, vendorId: string): void {
    if (dayBookings.some((b) => b.pitchId === pitchId)) throw new BusinessRuleError('pitch is already booked that day');
    if (dayBookings.some((b) => b.vendorId === vendorId)) throw new BusinessRuleError('vendor already has a pitch that day');
  }
}
