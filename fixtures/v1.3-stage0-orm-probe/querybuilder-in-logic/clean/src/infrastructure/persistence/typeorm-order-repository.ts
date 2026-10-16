import type { Repository } from 'typeorm';
import { Order } from '../../domain/entities/order';
import type { OrderRepository } from '../../domain/repositories/order-repository';
import { OrderRecord } from './order.orm-entity';

export class TypeOrmOrderRepository implements OrderRepository {
  constructor(private readonly records: Repository<OrderRecord>) {}

  async save(order: Order): Promise<void> {
    const record = new OrderRecord();
    record.id = order.id;
    record.customerId = order.customerId;
    record.totalCents = order.totalCents;
    await this.records.save(record);
  }

  async findById(id: string): Promise<Order | null> {
    const record = await this.records.findOneBy({ id });
    return record === null ? null : Order.create(record.id, record.customerId, record.totalCents);
  }
}
