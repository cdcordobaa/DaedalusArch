import { DataSource } from 'typeorm';
import { Order } from '../../domain/entities/order';
import type { OrderRepository } from '../../domain/repositories/order-repository';

export interface PlaceOrderInput {
  readonly id: string;
  readonly customerId: string;
  readonly totalCents: number;
}

export class PlaceOrderUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly orders: OrderRepository,
  ) {}

  async execute(input: PlaceOrderInput): Promise<Order> {
    const order = Order.create(input.id, input.customerId, input.totalCents);
    await this.dataSource.transaction(async () => {
      await this.orders.save(order);
    });
    return order;
  }
}
