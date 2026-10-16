// violating (use-case-framework-free): the use case imports the ORM.
import { Repository } from 'typeorm';
import { Order } from '../../domain/entities/Order';
import { Money } from '../../domain/value-objects/Money';
import { OrderDto } from '../dto/OrderDto';

export class CreateOrder {
  constructor(private readonly orders: Repository<Order>) {}
  async execute(id: string, cents: number): Promise<OrderDto> {
    const order = new Order(id, new Money(cents));
    await this.orders.save(order);
    return { id: order.id, totalCents: order.total.cents };
  }
}
