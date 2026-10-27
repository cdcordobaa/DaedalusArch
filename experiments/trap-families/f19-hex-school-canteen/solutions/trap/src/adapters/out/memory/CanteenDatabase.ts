import type { Dish } from '../../../domain/model/Dish';
import type { MealOrder } from '../../../domain/model/MealOrder';
import type { Pupil } from '../../../domain/model/Pupil';

/** The canteen's tables, kept in memory. */
export class CanteenDatabase {
  readonly pupils = new Map<string, Pupil>();
  readonly dishes = new Map<string, Dish>();
  readonly orders = new Map<string, MealOrder>();
  private readonly counters = new Map<string, number>();

  /** P-0001, D-0001, O-0001, ... per prefix. */
  next(prefix: string): string {
    const n = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, n);
    return `${prefix}-${String(n).padStart(4, '0')}`;
  }
}
