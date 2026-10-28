import type { IngredientLot } from './ingredientLot';

export interface LotStore {
  nextLotId(): string;
  lookup(lotId: string): IngredientLot | undefined;
  /** Keeps the lot and posts the facts it raised, in one step. */
  keep(lot: IngredientLot): void;
}
