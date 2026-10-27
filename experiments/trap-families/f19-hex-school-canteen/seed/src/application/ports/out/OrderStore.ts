import type { MealOrder } from '../../../domain/model/MealOrder';

export interface OrderStore {
  nextId(): string;
  save(order: MealOrder): void;
  byId(id: string): MealOrder | null;
}
