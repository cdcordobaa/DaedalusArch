import type { VendorRepository } from '../../licensing/domain/vendor/VendorRepository';
import { VendorId } from '../../licensing/domain/vendor/value-objects/VendorId';
import type { MarketDayRepository } from '../domain/day/MarketDayRepository';
import { dayOf } from './marketDays';

/** The warden's sheet for a day: one line per booked pitch, with the vendor's trading name. */
export class PitchPlan {
  constructor(
    private readonly vendors: VendorRepository,
    private readonly days: MarketDayRepository,
  ) {}

  linesFor(date: string): string[] {
    return dayOf(this.days, date).plan().map((b) => {
      const name = this.vendors.find(VendorId.of(b.vendorId))?.tradingName ?? b.vendorId;
      return `${b.pitch} ${name}: ${b.attendance}`;
    });
  }
}
