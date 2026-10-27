import { CanteenError } from '../errors/CanteenError';
import type { Pence } from './Pence';
import type { SchoolDate } from './SchoolDate';

export type OrderStatus = 'placed' | 'cancelled';

/** One meal ordered for one pupil on one serving day, paid when placed. */
export class MealOrder {
  private currentStatus: OrderStatus = 'placed';

  constructor(
    readonly id: string,
    readonly pupilId: string,
    readonly dishId: string,
    readonly servingDate: SchoolDate,
    readonly price: Pence,
  ) {}

  get status(): OrderStatus {
    return this.currentStatus;
  }

  /** A meal that will be cooked and paid for. */
  isServed(): boolean {
    return this.currentStatus === 'placed';
  }

  /** Cancelling closes, like ordering, at the end of the day before the meal. */
  cancel(today: SchoolDate): void {
    if (this.currentStatus === 'cancelled') throw new CanteenError(`order ${this.id} is cancelled`);
    if (this.servingDate <= today) throw new CanteenError(`order ${this.id} can no longer be cancelled`);
    this.currentStatus = 'cancelled';
  }
}
