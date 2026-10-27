import type { Dish } from '../../../domain/model/Dish';

export interface DishStore {
  nextId(): string;
  save(dish: Dish): void;
  byId(id: string): Dish | null;
}
