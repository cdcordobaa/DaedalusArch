import { CellarRefusal } from '../domain/CellarRefusal';
import { bottle, brew, type BrewBatch } from '../domain/batch/brewBatch';
import type { BatchStore } from '../domain/batch/BatchStore';
import { confirmSupply } from '../domain/lot/ingredientLot';
import type { LotStore } from '../domain/lot/LotStore';
import { gramsFromKg } from '../domain/value-objects/weight';
import { lotOrRefuse } from './lotCommands';

const batchOrRefuse = (batches: BatchStore, batchId: string): BrewBatch => {
  const batch = batches.lookup(batchId);
  if (batch === undefined) throw new CellarRefusal(`no batch ${batchId}`);
  return batch;
};

/**
 * Brewing records the batch only. The lots give their grams when `batch-brewed` reaches `supplyLots`, which the relay
 * does before the command returns. Every lot is asked first, so a refused brew keeps nothing.
 */
export function brewDay(deps: { readonly lots: LotStore; readonly batches: BatchStore; readonly today: () => string }) {
  return {
    brew(batchId: string, uses: readonly { lotId: string; kg: number }[]): void {
      const day = deps.today();
      const batch = batchOrRefuse(deps.batches, batchId);
      const draws = uses.map((use) => ({ lotId: use.lotId, grams: gramsFromKg(use.kg) }));
      for (const draw of draws) confirmSupply(lotOrRefuse(deps.lots, draw.lotId), draw.grams, day);
      deps.batches.record(brew(batch, draws, day));
    },
    bottle(batchId: string): void {
      deps.batches.record(bottle(batchOrRefuse(deps.batches, batchId), deps.today()));
    },
  };
}
