import type { Repository } from 'typeorm';
import { Order } from '../../../domain/entities/order';
import type { OrderRepository } from '../../../domain/ports/order-repository';

export class TypeOrmOrderRepository implements OrderRepository {
  constructor(private readonly orders: Repository<Order>) {}

  async save(order: Order): Promise<void> {
    await this.orders.save(order);
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.findOneBy({ id });
  }
}
