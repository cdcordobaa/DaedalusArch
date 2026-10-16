import { Order } from '../order/Order';
import { CustomerId } from './value-objects/CustomerId';

export class Customer {
  private readonly lastOrderId: string;
  // look-alike (aggregate-reference-by-identity): a plain constructor parameter, not stored; only its id is kept.
  constructor(readonly id: CustomerId, firstOrder: Order) {
    this.lastOrderId = firstOrder.id;
  }
  lastOrder(): string {
    return this.lastOrderId;
  }
}
