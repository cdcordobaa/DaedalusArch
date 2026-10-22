import { Money } from '../../shared-kernel/Money';
import type { CustomerRepository } from '../domain/customer/CustomerRepository';
import { Order } from '../domain/order/Order';
import type { OrderRepository } from '../domain/order/OrderRepository';
import type { CreditCheck } from './ports/CreditCheck';
import type { CustomerSync } from './ports/CustomerSync';

export class PlaceOrderOnCredit {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly orders: OrderRepository,
    private readonly credit: CreditCheck,
    private readonly sync: CustomerSync,
  ) {}

  /** Places the order and, through a port, also saves the changed Customer: two aggregates in one command. */
  async execute(customerId: string, totalCents: number): Promise<string> {
    const customer = await this.customers.byId(customerId);
    if (customer === undefined) throw new Error(`no customer ${customerId}`);
    const total = Money.of(totalCents);
    if (!this.credit.assess(customer, total).approved) throw new Error('credit declined');
    const order = Order.place(this.orders.nextId(), customer.id, total);
    await this.orders.save(order);
    await this.sync.purchased(customer);
    return order.id;
  }
}
