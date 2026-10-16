import { UserRecord } from './user.record';
import type { OrderRow } from './order.row';

export class UserRepository {
  async findById(id: number): Promise<UserRecord> {
    const r = new UserRecord();
    r.id = id;
    return r;
  }
  findByIdSync(id: number): UserRecord {
    const r = new UserRecord();
    r.id = id;
    return r;
  }
  async findOrders(userId: number): Promise<Array<OrderRow>> {
    return [{ id: 1, userId, totalCents: 100 }];
  }
  save(record: UserRecord): void {
    void record;
  }
}
