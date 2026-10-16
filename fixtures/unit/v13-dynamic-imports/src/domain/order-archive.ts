import { Order } from './order';

// Domain code that reaches outward only through a dynamic import (the MO-X01 shape).
export class OrderArchive {
  async archive(order: Order): Promise<void> {
    const { Db } = await import('../infrastructure/db');
    new Db().save(order.id);
  }
}
