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

  cancel(): void {
    this.currentStatus = 'cancelled';
  }
}
