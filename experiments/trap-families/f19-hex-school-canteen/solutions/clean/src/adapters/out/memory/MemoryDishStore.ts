import type { DishStore } from '../../../application/ports/out/DishStore';
import type { Dish } from '../../../domain/model/Dish';
import type { CanteenDatabase } from './CanteenDatabase';

export class MemoryDishStore implements DishStore {
  constructor(private readonly db: CanteenDatabase) {}

  nextId(): string {
    return this.db.next('D');
  }

  save(dish: Dish): void {
    this.db.dishes.set(dish.id, dish);
  }

  byId(id: string): Dish | null {
    return this.db.dishes.get(id) ?? null;
  }
}
