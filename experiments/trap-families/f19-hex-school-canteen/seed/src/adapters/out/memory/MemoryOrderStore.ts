import type { OrderStore } from '../../../application/ports/out/OrderStore';
import type { MealOrder } from '../../../domain/model/MealOrder';
import type { CanteenDatabase } from './CanteenDatabase';

export class MemoryOrderStore implements OrderStore {
  constructor(private readonly db: CanteenDatabase) {}

  nextId(): string {
    return this.db.next('O');
  }

  save(order: MealOrder): void {
    this.db.orders.set(order.id, order);
  }

  byId(id: string): MealOrder | null {
    return this.db.orders.get(id) ?? null;
  }
}
