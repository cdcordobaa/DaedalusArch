import type { FlourOrder } from '../../../domain/model/FlourOrder';
import type { FlourOrders } from '../../../application/ports/out/FlourOrders';

export class InMemoryFlourOrders implements FlourOrders {
  private readonly rows: FlourOrder[] = [];

  async save(order: FlourOrder): Promise<void> {
    this.rows.push(order);
  }
}
