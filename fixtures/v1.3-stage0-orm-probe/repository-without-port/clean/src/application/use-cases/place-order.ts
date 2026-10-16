import type { Repository } from 'typeorm';
import { Order } from '../../domain/entities/order';

export interface PlaceOrderInput {
  readonly id: string;
  readonly customerId: string;
  readonly totalCents: number;
}

export class PlaceOrderUseCase {
  constructor(private readonly orders: Repository<Order>) {}

  async execute(input: PlaceOrderInput): Promise<Order> {
    const order = Order.create(input.id, input.customerId, input.totalCents);
    await this.orders.save(order);
    return order;
  }
}
