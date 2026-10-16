import { InMemoryDatabase } from './Database';
import { OrderRecord } from './records/OrderRecord';

/** Table Data Gateway for the orders table (lines are stored inline). */
export class OrderGateway {
  constructor(private readonly db: InMemoryDatabase) {}

  findById(id: string): OrderRecord | undefined {
    return this.db.table<OrderRecord>('orders').get(id);
  }

  findByCustomer(customerId: string): OrderRecord[] {
    return [...this.db.table<OrderRecord>('orders').values()].filter((row) => row.customerId === customerId);
  }

  save(record: OrderRecord): void {
    this.db.table<OrderRecord>('orders').set(record.id, { ...record, lines: record.lines.map((l) => ({ ...l })) });
  }
}
