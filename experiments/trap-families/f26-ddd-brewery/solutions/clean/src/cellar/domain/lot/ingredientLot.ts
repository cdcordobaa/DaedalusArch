import { CellarRefusal } from '../CellarRefusal';
import type { CellarEvent } from '../events';
import { isEarlier } from '../value-objects/calendar';
import { formatKg } from '../value-objects/weight';

export interface LotDraw {
  readonly batchId: string;
  readonly grams: number;
}

/**
 * One delivery of one ingredient (malt, hops, yeast...). What is left never goes below zero, a lot is never
 * accepted when it is already past its best-before date, and it never supplies a brew after that date.
 */
export interface IngredientLot {
  readonly id: string;
  readonly ingredient: string;
  readonly gramsLeft: number;
  readonly bestBefore: string;
  /** Brews this lot supplied, oldest first; one entry per batch. */
  readonly draws: readonly LotDraw[];
  /** Facts raised by the last change, waiting to be kept. */
  readonly raised: readonly CellarEvent[];
}

export function acceptDelivery(id: string, ingredient: string, grams: number, bestBefore: string, today: string): IngredientLot {
  if (ingredient.trim() === '') throw new CellarRefusal('a delivery needs an ingredient name');
  if (grams <= 0) throw new CellarRefusal('a delivery must be more than zero kg');
  if (isEarlier(bestBefore, today)) throw new CellarRefusal(`lot ${id} is already past its best-before date ${bestBefore}`);
  return { id, ingredient, gramsLeft: grams, bestBefore, draws: [], raised: [{ kind: 'lot-received', lotId: id, ingredient, grams }] };
}

/** Takes grams out of the lot (spillage, a sample, a write-off). */
export function takeFromLot(lot: IngredientLot, grams: number): IngredientLot {
  if (grams <= 0) throw new CellarRefusal('the quantity taken from a lot must be more than zero kg');
  if (grams > lot.gramsLeft) throw new CellarRefusal(`not enough in lot ${lot.id}: ${formatKg(lot.gramsLeft)} left`);
  return { ...lot, gramsLeft: lot.gramsLeft - grams, raised: [] };
}

/** Refuses when the lot cannot give these grams to a brew on this day. Changes nothing. */
export function confirmSupply(lot: IngredientLot, grams: number, day: string): void {
  if (isEarlier(lot.bestBefore, day)) throw new CellarRefusal(`lot ${lot.id} is past its best-before date ${lot.bestBefore}`);
  takeFromLot(lot, grams);
}

/** Gives grams to a brewed batch. A second delivery of the same brew changes nothing. */
export function supplyBrew(lot: IngredientLot, batchId: string, grams: number): IngredientLot {
  if (lot.draws.some((d) => d.batchId === batchId)) return withoutRaised(lot);
  return { ...takeFromLot(lot, grams), draws: [...lot.draws, { batchId, grams }] };
}

export const usageNewestFirst = (lot: IngredientLot): LotDraw[] => [...lot.draws].reverse();

export const withoutRaised = (lot: IngredientLot): IngredientLot => ({ ...lot, raised: [] });
