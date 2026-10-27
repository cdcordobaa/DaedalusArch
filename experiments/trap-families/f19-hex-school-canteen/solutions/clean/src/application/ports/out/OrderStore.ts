import type { MealOrder } from '../../../domain/model/MealOrder';

export interface OrderStore {
  nextId(): string;
  save(order: MealOrder): void;
  byId(id: string): MealOrder | null;
  /** Every order for a serving day, cancelled ones included, in id order. */
  forDate(date: string): MealOrder[];
}
