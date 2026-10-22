import type { OrderRepository } from '../domain/order/OrderRepository';

export class MergeOrders {
  constructor(private readonly orders: OrderRepository) {}

  /** Confirms the kept order and cancels the duplicate: two instances of Order changed in one command. */
  async execute(keepId: string, dropId: string): Promise<void> {
    const keep = await this.orders.byId(keepId);
    const drop = await this.orders.byId(dropId);
    if (keep === undefined || drop === undefined) throw new Error('both orders must exist');
    keep.confirm();
    drop.cancel();
    await this.orders.save(keep);
    await this.orders.save(drop);
  }
}
