import { CellarRefusal } from '../domain/CellarRefusal';
import { acceptDelivery, takeFromLot, type IngredientLot } from '../domain/lot/ingredientLot';
import type { LotStore } from '../domain/lot/LotStore';
import { gramsFromKg } from '../domain/value-objects/weight';

export const lotOrRefuse = (lots: LotStore, lotId: string): IngredientLot => {
  const lot = lots.lookup(lotId);
  if (lot === undefined) throw new CellarRefusal(`no lot ${lotId}`);
  return lot;
};

export function lotCommands(deps: { readonly lots: LotStore; readonly today: () => string }) {
  return {
    receive(ingredient: string, kg: number, bestBefore: string): string {
      const lot = acceptDelivery(deps.lots.nextLotId(), ingredient, gramsFromKg(kg), bestBefore, deps.today());
      deps.lots.keep(lot);
      return lot.id;
    },
    writeOff(lotId: string, kg: number): void {
      deps.lots.keep(takeFromLot(lotOrRefuse(deps.lots, lotId), gramsFromKg(kg)));
    },
  };
}
