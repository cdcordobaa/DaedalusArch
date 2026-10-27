import type { Ordering } from '../../../application/ports/in/Ordering';
import { reply, type Reply } from '../shared/reply';

/** Parents ordering meals. */
export class OrderRoutes {
  constructor(private readonly ordering: Ordering) {}

  placeOrder(pupilId: string, dishId: string, date: unknown): Reply {
    return reply(() => this.ordering.place(pupilId, dishId, date));
  }

  order(orderId: string): Reply {
    return reply(() => this.ordering.order(orderId));
  }

  cancelOrder(orderId: string): Reply {
    return reply(() => this.ordering.cancel(orderId));
  }
}
