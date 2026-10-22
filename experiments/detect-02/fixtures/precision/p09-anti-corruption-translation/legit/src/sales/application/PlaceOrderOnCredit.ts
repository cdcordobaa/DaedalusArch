import { Money } from '../../shared-kernel/Money';
import type { CustomerRepository } from '../domain/customer/CustomerRepository';
import { Order } from '../domain/order/Order';
import type { OrderRepository } from '../domain/order/OrderRepository';
import type { CreditCheck } from './ports/CreditCheck';

export class PlaceOrderOnCredit {
  constructor(private readonly customers: CustomerRepository, private readonly orders: OrderRepository, private readonly credit: CreditCheck) {}

  async execute(customerId: string, totalCents: number): Promise<string> {
    const customer = await this.customers.byId(customerId);
    if (customer === undefined) throw new Error(`no customer ${customerId}`);
    const total = Money.of(totalCents);
    const decision = this.credit.assess(customer, total);
    if (!decision.approved) throw new Error(`credit ${decision.reason}`);
    const order = Order.place(this.orders.nextId(), customer.id, total);
    await this.orders.save(order);
    return order.id;
  }
}
