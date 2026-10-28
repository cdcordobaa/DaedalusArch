import { CellarRefusal } from '../CellarRefusal';
import type { CellarEvent } from '../events';
import { isEarlier } from '../value-objects/calendar';
import { formatKg } from '../value-objects/weight';

/**
 * One delivery of one ingredient (malt, hops, yeast...). What is left never goes below zero, and a lot is never
 * accepted when it is already past its best-before date.
 */
export interface IngredientLot {
  readonly id: string;
  readonly ingredient: string;
  readonly gramsLeft: number;
  readonly bestBefore: string;
  /** Facts raised by the last change, waiting to be kept. */
  readonly raised: readonly CellarEvent[];
}

export function acceptDelivery(id: string, ingredient: string, grams: number, bestBefore: string, today: string): IngredientLot {
  if (ingredient.trim() === '') throw new CellarRefusal('a delivery needs an ingredient name');
  if (grams <= 0) throw new CellarRefusal('a delivery must be more than zero kg');
  if (isEarlier(bestBefore, today)) throw new CellarRefusal(`lot ${id} is already past its best-before date ${bestBefore}`);
  return { id, ingredient, gramsLeft: grams, bestBefore, raised: [{ kind: 'lot-received', lotId: id, ingredient, grams }] };
}

/** Takes grams out of the lot (spillage, a sample, a write-off). */
export function takeFromLot(lot: IngredientLot, grams: number): IngredientLot {
  if (grams <= 0) throw new CellarRefusal('the quantity taken from a lot must be more than zero kg');
  if (grams > lot.gramsLeft) throw new CellarRefusal(`not enough in lot ${lot.id}: ${formatKg(lot.gramsLeft)} left`);
  return { ...lot, gramsLeft: lot.gramsLeft - grams, raised: [] };
}

/** Takes grams out of the lot for a brew; a lot past its best-before date is not used. */
export function useInBrew(lot: IngredientLot, grams: number, today: string): IngredientLot {
  if (isEarlier(lot.bestBefore, today)) throw new CellarRefusal(`lot ${lot.id} is past its best-before date ${lot.bestBefore}`);
  return takeFromLot(lot, grams);
}

export const withoutRaised = (lot: IngredientLot): IngredientLot => ({ ...lot, raised: [] });
