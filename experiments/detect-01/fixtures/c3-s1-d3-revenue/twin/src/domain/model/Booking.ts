import { DateRange } from './DateRange';
import { Money } from './Money';

/** Entity: one booking of one room, with its total price. */
export class Booking {
  constructor(readonly id: string, readonly roomId: string, readonly stay: DateRange, readonly total: Money) {}

  /**
   * The booking's total spread over its nights in whole cents, first night first; the first nights carry the odd
   * cents so the parts sum to the total exactly.
   */
  nightlyShares(): Money[] {
    const nights = this.stay.nights();
    const base = Math.floor(this.total.cents / nights);
    const extra = this.total.cents - base * nights;
    return Array.from({ length: nights }, (_, i) => new Money(base + (i < extra ? 1 : 0), this.total.currency));
  }
}
