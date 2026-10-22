import { DateRange } from './DateRange';
import { Money } from './Money';

/** Entity: one booking of one room, with its total price. */
export class Booking {
  constructor(readonly id: string, readonly roomId: string, readonly stay: DateRange, readonly total: Money) {}
}
