import type { CustomerRef } from '../../shared-kernel/CustomerRef';
import type { Order } from '../domain/order/Order';
import type { OrderQueries } from '../domain/order/OrderQueries';

export class InMemoryOrderQueries implements OrderQueries {
  constructor(private readonly rows: Map<string, Order> = new Map()) {}

  async openFor(customer: CustomerRef): Promise<readonly Order[]> {
    return [...this.rows.values()].filter((o) => o.customerId === customer.id && o.state === 'placed');
  }
}
