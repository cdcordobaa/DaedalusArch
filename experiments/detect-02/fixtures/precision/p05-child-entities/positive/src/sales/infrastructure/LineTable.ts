import type { OrderLine } from '../domain/order/OrderLine';

export class LineTable {
  private readonly rows = new Map<string, { orderId: string; line: OrderLine }>();

  upsert(orderId: string, line: OrderLine): void {
    this.rows.set(line.id, { orderId, line });
  }
}
